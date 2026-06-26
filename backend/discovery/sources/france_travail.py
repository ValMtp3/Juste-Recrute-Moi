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
_ERROR_EXCERPT_LEN = 220


def _response_excerpt(response: httpx.Response) -> str:
    text = str(response.text or "").strip().replace("\n", " ")
    if not text:
        return "réponse vide"
    return text[:_ERROR_EXCERPT_LEN]


def _json_response(response: httpx.Response, *, context: str) -> dict:
    try:
        payload = response.json()
    except ValueError as exc:
        content_type = response.headers.get("content-type", "inconnu")
        raise RuntimeError(
            f"France Travail {context} a renvoyé une réponse non JSON "
            f"(HTTP {response.status_code}, content-type={content_type}) : {_response_excerpt(response)}"
        ) from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"France Travail {context} a renvoyé un JSON inattendu ({type(payload).__name__})")
    return payload


def _env_client() -> tuple[str, str]:
    settings: dict[str, Any] = {}
    try:
        from data.repository import create_repository

        settings = create_repository().settings.get_settings()
    except Exception:
        settings = {}
    client_id = str(settings.get("france_travail_client_id") or os.environ.get("FRANCE_TRAVAIL_CLIENT_ID", "")).strip()
    client_secret = str(settings.get("france_travail_client_secret") or os.environ.get("FRANCE_TRAVAIL_CLIENT_SECRET", "")).strip()
    if not client_id or not client_secret:
        raise RuntimeError("Identifiants France Travail absents : renseignez-les dans Paramètres > Découverte ou via FRANCE_TRAVAIL_CLIENT_ID / FRANCE_TRAVAIL_CLIENT_SECRET")
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
            raise RuntimeError(f"Authentification France Travail impossible : {detail}") from exc
        payload = _json_response(response, context="authentification")
    token = str(payload.get("access_token") or "").strip()
    if not token:
        raise RuntimeError("La réponse France Travail ne contient pas de jeton d'accès")
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
            "identifiants invalides - vérifiez FRANCE_TRAVAIL_CLIENT_ID / "
            "FRANCE_TRAVAIL_CLIENT_SECRET et l'activation de l'API Offres d'emploi"
        )
    if error or description:
        return " - ".join(part for part in [error, description] if part)
    return f"HTTP {response.status_code} : {_response_excerpt(response)}"


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
    try:
        from data.repository import create_repository
        db_settings = create_repository().settings.get_settings()
        max_reqs = int(db_settings.get("free_source_max_requests", "20"))
    except Exception:
        max_reqs = 20

    default_range = "0-49"
    if max_reqs <= 5:
        default_range = "0-19"
    elif max_reqs > 20:
        default_range = "0-149"

    target_range = parsed.get("range")
    if not target_range or target_range == "0-49":
        range_val = default_range
    else:
        range_val = target_range

    params = {
        "motsCles": parsed.get("motsCles") or parsed.get("q") or parsed.get("query") or "developpeur",
        "range": range_val,
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


def _fallback_search_params(params: dict[str, str]) -> dict[str, str]:
    """Keep the stable search core if France Travail rejects optional filters."""
    return {key: value for key, value in params.items() if key in {"motsCles", "range", "lieu"}}


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
        if response.status_code == 204 or (200 <= response.status_code < 300 and not (response.content or b"").strip()):
            return {"resultats": []}
        response.raise_for_status()
        return _json_response(response, context="recherche")


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
    try:
        payload = await _json_search(params)
    except httpx.HTTPStatusError as exc:
        fallback = _fallback_search_params(params)
        if exc.response.status_code != 400 or fallback == params:
            raise
        payload = await _json_search(fallback)
        cache_key = repr(sorted(fallback.items()))
    rows = payload.get("resultats") if isinstance(payload, dict) else []
    leads = [
        offer_to_lead(offer)
        for offer in (offer_from_result(row) for row in rows or [] if isinstance(row, dict))
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
