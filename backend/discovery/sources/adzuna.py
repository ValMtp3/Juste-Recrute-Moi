from __future__ import annotations

import asyncio
import os
from time import monotonic
from typing import Any

import httpx

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text
from discovery.sources.net import guarded_async_client

_SEARCH_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600

def _env_client() -> tuple[str, str]:
    settings: dict[str, Any] = {}
    try:
        from data.repository import create_repository
        settings = create_repository().settings.get_settings()
    except Exception:
        settings = {}
    app_id = str(settings.get("adzuna_app_id") or os.environ.get("ADZUNA_APP_ID", "")).strip()
    api_key = str(settings.get("adzuna_api_key") or os.environ.get("ADZUNA_API_KEY", "")).strip()
    return app_id, api_key

def _parse_target(target: str) -> dict[str, str]:
    raw = target.split(":", 1)[1] if target.lower().startswith("adzuna:") else target
    params: dict[str, str] = {}
    parts = [part.strip() for part in raw.replace("|", ";").split(";") if part.strip()]
    if parts and "=" not in parts[0]:
        params["what"] = parts[0]
        parts = parts[1:]
    for part in parts:
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            params[key] = value
    return params

def _search_params(target: str) -> dict[str, str]:
    parsed = _parse_target(target)
    app_id, api_key = _env_client()
    try:
        from data.repository import create_repository
        db_settings = create_repository().settings.get_settings()
        max_reqs = int(db_settings.get("free_source_max_requests", "20"))
    except Exception:
        max_reqs = 20

    default_results = "50"
    if max_reqs <= 5:
        default_results = "15"
    elif max_reqs > 20:
        default_results = "150"

    results_val = parsed.get("results")
    if not results_val or results_val == "50":
        results_val = default_results

    params = {
        "app_id": app_id,
        "app_key": api_key,
        "results_per_page": results_val,
        "what": parsed.get("what") or parsed.get("q") or parsed.get("query") or "developpeur",
        "where": parsed.get("where") or parsed.get("location") or parsed.get("lieu") or "France",
        "content-type": "application/json",
    }
    return params

async def _json_search(params: dict[str, str]) -> dict:
    if not params.get("app_id") or not params.get("app_key"):
        return {"results": []}

    url = "https://api.adzuna.com/v1/api/jobs/fr/search/1"
    headers = {
        "Accept": "application/json",
        "User-Agent": "Juste Recrute Moi Adzuna connector",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.get(url, params=params)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.get(url, params=params)
        if response.status_code == 204 or (200 <= response.status_code < 300 and not (response.content or b"").strip()):
            return {"results": []}
        response.raise_for_status()
        return response.json()

def offer_from_result(row: dict) -> JobOffer:
    company = row.get("company") or {}
    location = row.get("location") or {}

    salary_min = row.get("salary_min")
    salary_max = row.get("salary_max")

    contract_type = str(row.get("contract_type") or row.get("contract_time") or "").strip()
    remote = True if "remote" in str(row.get("title", "")).lower() or "télétravail" in str(row.get("description", "")).lower() else None

    return JobOffer(
        source="adzuna",
        source_job_id=str(row.get("id") or "").strip(),
        title=str(row.get("title") or "").strip(),
        company=str(company.get("display_name") or "").strip(),
        location=str(location.get("display_name") or "").strip(),
        remote=remote,
        contract_type=contract_type,
        salary_min=float(salary_min) if salary_min is not None else None,
        salary_max=float(salary_max) if salary_max is not None else None,
        salary_currency="EUR",
        description=clean_text(str(row.get("description") or ""))[:1600],
        apply_url=str(row.get("redirect_url") or ""),
        original_url=str(row.get("redirect_url") or ""),
        posted_at=str(row.get("created") or "").strip(),
        tags=[tag for tag in [row.get("category", {}).get("label")] if tag],
        raw=row,
        platform="adzuna",
        reliability="stable",
    )

async def scrape_target(target: str) -> list[dict]:
    params = _search_params(target)
    if not params.get("app_id") or not params.get("app_key"):
        return []

    cache_key = repr(sorted(params.items()))
    cached = _SEARCH_CACHE.get(cache_key)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])

    try:
        payload = await _json_search(params)
    except httpx.HTTPStatusError:
        raise

    rows = payload.get("results") if isinstance(payload, dict) else []
    leads = [
        offer_to_lead(offer)
        for offer in (offer_from_result(row) for row in rows or [] if isinstance(row, dict))
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
