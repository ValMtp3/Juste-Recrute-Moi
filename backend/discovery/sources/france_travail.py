from __future__ import annotations

import asyncio
import os
from time import monotonic
from typing import Any

import httpx

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text
from discovery.sources.net import guarded_async_client

TOKEN_URL = os.environ.get(
    "FRANCE_TRAVAIL_TOKEN_URL",
    "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire",
)
SEARCH_URL = os.environ.get(
    "FRANCE_TRAVAIL_SEARCH_URL",
    "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search",
)
DEFAULT_SCOPE = os.environ.get("FRANCE_TRAVAIL_SCOPE", "api_offresdemploiv2 o2dsoffre")

_TOKEN_CACHE: dict[str, Any] = {}
_SEARCH_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600


def _env_client() -> tuple[str, str]:
    client_id = os.environ.get("FRANCE_TRAVAIL_CLIENT_ID", "").strip()
    client_secret = os.environ.get("FRANCE_TRAVAIL_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        raise RuntimeError("France Travail credentials missing: set FRANCE_TRAVAIL_CLIENT_ID and FRANCE_TRAVAIL_CLIENT_SECRET")
    return client_id, client_secret


async def _access_token() -> str:
    now = monotonic()
    cached = _TOKEN_CACHE.get("value")
    expires_at = float(_TOKEN_CACHE.get("expires_at") or 0)
    if cached and expires_at > now + 60:
        return str(cached)

    client_id, client_secret = _env_client()
    data = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": DEFAULT_SCOPE,
    }
    async with guarded_async_client(timeout=20, follow_redirects=True) as cx:
        response = await cx.post(TOKEN_URL, data=data, headers={"Accept": "application/json"})
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = _oauth_error_detail(response)
            raise RuntimeError(f"France Travail OAuth failed: {detail}") from exc
        payload = response.json()
    token = str(payload.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("France Travail token response did not include access_token")
    _TOKEN_CACHE["value"] = token
    _TOKEN_CACHE["expires_at"] = now + int(payload.get("expires_in") or 1500)
    return token


def _oauth_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    error = str(payload.get("error") or "").strip()
    description = str(payload.get("error_description") or "").strip()
    if error == "invalid_client":
        return (
            "invalid_client - vérifiez FRANCE_TRAVAIL_CLIENT_ID / "
            "FRANCE_TRAVAIL_CLIENT_SECRET et l'activation de l'API Offres d'emploi"
        )
    if error or description:
        return " - ".join(part for part in [error, description] if part)
    return f"HTTP {response.status_code}"


def _parse_target(target: str) -> dict[str, str]:
    raw = target.split(":", 1)[1] if target.lower().startswith("france_travail:") else target
    params: dict[str, str] = {}
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


def _search_params(target: str) -> dict[str, str]:
    parsed = _parse_target(target)
    params = {
        "motsCles": parsed.get("motsCles") or parsed.get("q") or parsed.get("query") or "developpeur",
        "range": parsed.get("range") or "0-49",
    }
    mapping = {
        "lieu": "lieu",
        "location": "lieu",
        "rayon": "rayon",
        "contract": "contrat",
        "contrat": "contrat",
        "typeContrat": "typeContrat",
        "teletravail": "teletravail",
    }
    for src, dest in mapping.items():
        if parsed.get(src):
            params[dest] = parsed[src]
    return params


async def _json_search(params: dict[str, str]) -> dict:
    token = await _access_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "Juste Recrute Moi France Travail connector",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.get(SEARCH_URL, params=params)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.get(SEARCH_URL, params=params)
        response.raise_for_status()
        return response.json()


def _salary_value(raw: str) -> tuple[float | None, float | None]:
    import re

    numbers = [float(match.replace(",", ".")) for match in re.findall(r"\d+(?:[,.]\d+)?", raw or "")]
    if not numbers:
        return None, None
    if len(numbers) == 1:
        return numbers[0], None
    return min(numbers), max(numbers)


def offer_from_result(row: dict) -> JobOffer:
    company = row.get("entreprise") or {}
    place = row.get("lieu") or {}
    salary = row.get("salaire") or {}
    origin = row.get("origineOffre") or {}
    raw_salary = str(salary.get("libelle") or "")
    salary_min, salary_max = _salary_value(raw_salary)
    remote_code = str(row.get("teletravailCode") or "").upper()
    remote = True if remote_code in {"1", "2", "3", "OUI", "TELETRAVAIL_TOTAL"} else None
    source_id = str(row.get("id") or "").strip()
    url = str(origin.get("urlOrigine") or row.get("urlPostulation") or "").strip()
    if not url and source_id:
        url = f"https://candidat.francetravail.fr/offres/recherche/detail/{source_id}"
    return JobOffer(
        source="france_travail",
        source_job_id=source_id,
        title=str(row.get("intitule") or "").strip(),
        company=str(company.get("nom") or "").strip(),
        location=str(place.get("libelle") or "").strip(),
        remote=remote,
        contract_type=str(row.get("typeContratLibelle") or row.get("typeContrat") or "").strip(),
        salary_min=salary_min,
        salary_max=salary_max,
        salary_currency="EUR" if raw_salary else "",
        description=clean_text(str(row.get("description") or ""))[:1600],
        apply_url=url,
        original_url=url,
        posted_at=str(row.get("dateCreation") or row.get("dateActualisation") or "").strip(),
        tags=[tag for tag in [row.get("romeLibelle"), row.get("secteurActiviteLibelle")] if tag],
        raw=row,
        platform="france_travail",
        reliability="stable",
    )


async def scrape_target(target: str) -> list[dict]:
    params = _search_params(target)
    cache_key = repr(sorted(params.items()))
    cached = _SEARCH_CACHE.get(cache_key)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])
    payload = await _json_search(params)
    rows = payload.get("resultats") if isinstance(payload, dict) else []
    leads = [
        offer_to_lead(offer)
        for offer in (offer_from_result(row) for row in rows or [] if isinstance(row, dict))
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
