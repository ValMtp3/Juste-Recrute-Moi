from __future__ import annotations

import asyncio
from typing import Any

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text


def _parse_target(target: str) -> dict[str, Any]:
    raw = target.split(":", 1)[1] if target.lower().startswith("jobspy:") else target
    params: dict[str, Any] = {
        "search_term": "developpeur",
        "location": "France",
        "results_wanted": 25,
        "hours_old": 168,
        "site_name": ["indeed", "google"],
        "country_indeed": "France",
    }
    parts = [part.strip() for part in raw.replace("|", ";").split(";") if part.strip()]
    if parts and "=" not in parts[0]:
        params["search_term"] = parts[0]
        parts = parts[1:]
    for part in parts:
        if "=" not in part:
            continue
        key, value = [p.strip() for p in part.split("=", 1)]
        if key in {"sites", "site_name"}:
            params["site_name"] = [item.strip() for item in value.split(",") if item.strip()]
        elif key in {"results", "results_wanted"}:
            params["results_wanted"] = max(1, min(int(value), 100))
        elif key in {"hours", "hours_old"}:
            params["hours_old"] = max(1, min(int(value), 24 * 30))
        elif key in {"location", "search_term", "country_indeed"}:
            params[key] = value
    return params


def _row_get(row: Any, key: str, default=""):
    if isinstance(row, dict):
        return row.get(key, default)
    getter = getattr(row, "get", None)
    if callable(getter):
        try:
            return getter(key, default)
        except TypeError:
            pass
    return getattr(row, key, default)


def _rows_from_dataframe(value: Any) -> list[Any]:
    if hasattr(value, "to_dict"):
        return value.to_dict("records")
    if isinstance(value, list):
        return value
    return []


def _scrape_sync(params: dict[str, Any]) -> list[dict]:
    try:
        from jobspy import scrape_jobs
    except ImportError as exc:
        raise RuntimeError("JobSpy is not installed. Install python-jobspy to enable the jobspy connector.") from exc

    rows = _rows_from_dataframe(scrape_jobs(**params, verbose=0))
    leads: list[dict] = []
    for row in rows:
        site = str(_row_get(row, "site", _row_get(row, "SITE", "jobspy")) or "jobspy").lower()
        url = str(_row_get(row, "job_url", _row_get(row, "JOB_URL", "")) or "").strip()
        title = str(_row_get(row, "title", _row_get(row, "TITLE", "")) or "").strip()
        if not title or not url:
            continue
        city = str(_row_get(row, "city", "") or "").strip()
        state = str(_row_get(row, "state", "") or "").strip()
        country = str(_row_get(row, "country", "") or "").strip()
        location = ", ".join(part for part in [city, state, country] if part)
        min_amount = _row_get(row, "min_amount", None)
        max_amount = _row_get(row, "max_amount", None)
        currency = str(_row_get(row, "currency", "") or "EUR")
        offer = JobOffer(
            source="jobspy",
            source_job_id=str(_row_get(row, "id", "") or url),
            title=title,
            company=str(_row_get(row, "company", _row_get(row, "COMPANY", "")) or "").strip(),
            location=location,
            remote=bool(_row_get(row, "is_remote", False)),
            contract_type=str(_row_get(row, "job_type", "") or "").strip(),
            salary_min=float(min_amount) if min_amount not in (None, "") else None,
            salary_max=float(max_amount) if max_amount not in (None, "") else None,
            salary_currency=currency,
            description=clean_text(str(_row_get(row, "description", "") or ""))[:1600],
            apply_url=url,
            original_url=url,
            posted_at=str(_row_get(row, "date_posted", "") or ""),
            tags=[site],
            raw=dict(row) if isinstance(row, dict) else {},
            platform=f"jobspy_{site}",
            reliability="best_effort",
        )
        leads.append(offer_to_lead(offer))
    return leads


async def scrape_target(target: str) -> list[dict]:
    return await asyncio.to_thread(_scrape_sync, _parse_target(target))
