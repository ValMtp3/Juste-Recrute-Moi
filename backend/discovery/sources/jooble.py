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

def _env_client() -> str:
    settings: dict[str, Any] = {}
    try:
        from data.repository import create_repository
        settings = create_repository().settings.get_settings()
    except Exception:
        settings = {}
    return str(settings.get("jooble_api_key") or os.environ.get("JOOBLE_API_KEY", "")).strip()

def _parse_target(target: str) -> dict[str, str]:
    raw = target.split(":", 1)[1] if target.lower().startswith("jooble:") else target
    params: dict[str, str] = {}
    parts = [part.strip() for part in raw.replace("|", ";").split(";") if part.strip()]
    if parts and "=" not in parts[0]:
        params["keywords"] = parts[0]
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
    params = {
        "keywords": parsed.get("keywords") or parsed.get("q") or parsed.get("query") or "developpeur",
        "location": parsed.get("location") or parsed.get("lieu") or "France",
    }
    return params

async def _json_search(params: dict[str, str], api_key: str) -> dict:
    url = f"https://fr.jooble.org/api/{api_key}"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Juste Recrute Moi Jooble connector",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.post(url, json=params)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.post(url, json=params)
        if response.status_code == 204 or (200 <= response.status_code < 300 and not (response.content or b"").strip()):
            return {"jobs": []}
        response.raise_for_status()
        return response.json()

def offer_from_result(row: dict) -> JobOffer:
    salary_str = str(row.get("salary") or "")
    remote = True if "télétravail" in str(row.get("title", "")).lower() or "télétravail" in str(row.get("snippet", "")).lower() else None

    return JobOffer(
        source="jooble",
        source_job_id=str(row.get("id") or "").strip(),
        title=str(row.get("title") or "").strip(),
        company=str(row.get("company") or "").strip(),
        location=str(row.get("location") or "").strip(),
        remote=remote,
        contract_type="",
        salary_min=None,
        salary_max=None,
        salary_currency="EUR" if salary_str else "",
        description=clean_text(str(row.get("snippet") or ""))[:1600],
        apply_url=str(row.get("link") or ""),
        original_url=str(row.get("link") or ""),
        posted_at=str(row.get("updated") or "").strip(),
        tags=[],
        raw=row,
        platform="jooble",
        reliability="stable",
    )

async def scrape_target(target: str) -> list[dict]:
    api_key = _env_client()
    if not api_key:
        return []

    params = _search_params(target)
    cache_key = repr(sorted(params.items()))
    cached = _SEARCH_CACHE.get(cache_key)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])

    try:
        payload = await _json_search(params, api_key)
    except httpx.HTTPStatusError:
        raise

    rows = payload.get("jobs") if isinstance(payload, dict) else []
    leads = [
        offer_to_lead(offer)
        for offer in (offer_from_result(row) for row in rows or [] if isinstance(row, dict))
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
