from __future__ import annotations

import asyncio
from time import monotonic
from typing import Any

import httpx

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text
from discovery.sources.net import guarded_async_client

_SEARCH_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600

def _parse_target(target: str) -> dict[str, Any]:
    raw = target.split(":", 1)[1] if target.lower().startswith("apec:") else target
    params: dict[str, Any] = {
        "motsCles": "developpeur",
    }
    parts = [part.strip() for part in raw.replace("|", ";").split(";") if part.strip()]
    if parts and "=" not in parts[0]:
        params["motsCles"] = parts[0]
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

def _search_payload(target: str) -> dict[str, Any]:
    parsed = _parse_target(target)
    keywords = parsed.get("motsCles") or parsed.get("q") or parsed.get("query") or "developpeur"
    # L'API APEC attend un POST GraphQL ou REST specifique, ici on fait le POST simple
    payload = {
        "motsCles": keywords,
        # Lieux, fonctions etc. pourraient être rajoutés ici
        "pagination": {"activeIndex": 1, "selectedPage": 0, "limit": 50}
    }
    return payload

async def _json_search(payload: dict[str, Any]) -> dict:
    url = "https://www.apec.fr/cms/webservices/rechercheOffre"
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.post(url, json=payload)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.post(url, json=payload)
        if response.status_code == 204 or (200 <= response.status_code < 300 and not (response.content or b"").strip()):
            return {"resultats": []}
        response.raise_for_status()
        return response.json()

def offer_from_result(row: dict) -> JobOffer:
    company = str(row.get("nomEntreprise") or "")
    location = str(row.get("lieuDep") or row.get("lieu") or "")
    title = str(row.get("intitule") or "")
    url = f"https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/{row.get('numeroOffre')}" if row.get("numeroOffre") else ""
    remote = True if "télétravail" in str(row.get("texteTeletravail", "")).lower() else None

    return JobOffer(
        source="apec",
        source_job_id=str(row.get("numeroOffre") or "").strip(),
        title=title,
        company=company,
        location=location,
        remote=remote,
        contract_type=str(row.get("typeContrat") or ""),
        salary_min=None,
        salary_max=None,
        salary_currency="EUR",
        description=clean_text(str(row.get("texteHtml") or row.get("resume") or ""))[:1600],
        apply_url=url,
        original_url=url,
        posted_at=str(row.get("datePublication") or "").strip(),
        tags=[],
        raw=row,
        platform="apec",
        reliability="stable",
    )

async def scrape_target(target: str) -> list[dict]:
    payload = _search_payload(target)

    cache_key = repr(sorted(payload.items()))
    cached = _SEARCH_CACHE.get(cache_key)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])
        
    try:
        data = await _json_search(payload)
    except httpx.HTTPStatusError as exc:
        raise
        
    rows = data.get("resultats") if isinstance(data, dict) else []
    leads = [
        offer_to_lead(offer)
        for offer in (offer_from_result(row) for row in rows or [] if isinstance(row, dict))
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
