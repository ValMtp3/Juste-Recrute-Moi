from __future__ import annotations

import asyncio
import json
import re
from html import unescape
from time import monotonic
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse

import httpx

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text, strip_html_text
from discovery.sources.net import guarded_async_client

SEARCH_URL = "https://www.hellowork.com/fr-fr/emploi/recherche.html"

_SEARCH_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600


def _first_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in ("name", "value", "title", "label", "url", "address", "addressLocality", "addressRegion", "addressCountry"):
            text = _first_text(value.get(key))
            if text:
                return text
    if isinstance(value, list):
        return ", ".join(text for text in (_first_text(item) for item in value) if text)
    return ""


def _parse_target(target: str) -> dict[str, str]:
    raw = target.split(":", 1)[1] if target.lower().startswith("hellowork:") else target
    raw = raw.strip()
    if raw.startswith(("http://", "https://")):
        return {"url": raw}
    params = {
        key.strip().lower(): value.strip()
        for key, value in parse_qsl(raw.replace(";", "&").replace("|", "&"), keep_blank_values=False)
        if key.strip() and value.strip()
    }
    first = raw.replace("|", ";").split(";", 1)[0].strip()
    if first and "=" not in first and "&" not in first:
        params.setdefault("query", first)
    return params


def _search_url(target: str) -> str:
    params = _parse_target(target)
    if params.get("url"):
        return params["url"]
    query = params.get("query") or params.get("q") or params.get("k") or params.get("motscles") or "developpeur"
    location = params.get("location") or params.get("lieu") or params.get("l") or "France"
    query_params = {"k": query}
    if location:
        query_params["l"] = location
    return f"{SEARCH_URL}?{urlencode(query_params)}"


async def _fetch_html(url: str) -> str:
    headers = {
        "User-Agent": "Juste Recrute Moi HelloWork connector",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.get(url)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.get(url)
        if response.status_code == 404:
            return ""
        response.raise_for_status()
        return response.text


def _jsonld_blocks(html: str) -> list[Any]:
    blocks: list[Any] = []
    for match in re.finditer(r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", html or "", flags=re.I | re.S):
        raw = unescape(match.group(1).strip())
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return blocks


def _flatten_json(value: Any) -> list[dict]:
    out: list[dict] = []
    if isinstance(value, dict):
        graph = value.get("@graph")
        if isinstance(graph, list):
            for item in graph:
                out.extend(_flatten_json(item))
        out.append(value)
    elif isinstance(value, list):
        for item in value:
            out.extend(_flatten_json(item))
    return out


def _next_data(html: str) -> Any | None:
    match = re.search(r"<script[^>]+id=[\"']__NEXT_DATA__[\"'][^>]*>(.*?)</script>", html or "", flags=re.I | re.S)
    if not match:
        return None
    try:
        return json.loads(unescape(match.group(1).strip()))
    except json.JSONDecodeError:
        return None


def _iter_dicts(value: Any):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from _iter_dicts(item)
    elif isinstance(value, list):
        for item in value:
            yield from _iter_dicts(item)


def _source_id_from_url(url: str) -> str:
    parsed = urlparse(url)
    return parsed.path.strip("/").rsplit("/", 1)[-1].replace(".html", "") if parsed.path else url


def _offer_from_jobposting(base_url: str, item: dict) -> JobOffer | None:
    title = _first_text(item.get("title"))
    apply_url = _first_text(item.get("url") or item.get("sameAs"))
    if not title or not apply_url:
        return None
    apply_url = urljoin(base_url, apply_url)
    identifier = item.get("identifier")
    source_id = _first_text(identifier.get("value") if isinstance(identifier, dict) else identifier) or _source_id_from_url(apply_url)
    hiring = item.get("hiringOrganization") or {}
    description = clean_text(strip_html_text(_first_text(item.get("description"))))[:1600]
    remote_type = str(item.get("jobLocationType") or "").upper()
    remote = True if remote_type == "TELECOMMUTE" or "teletravail" in description.lower() or "télétravail" in description.lower() else None
    return JobOffer(
        source="hellowork",
        source_job_id=source_id,
        title=title,
        company=_first_text(hiring.get("name") if isinstance(hiring, dict) else hiring),
        location=_first_text(item.get("jobLocation") or item.get("applicantLocationRequirements")),
        remote=remote,
        contract_type=_first_text(item.get("employmentType")),
        description=description,
        apply_url=apply_url,
        original_url=base_url,
        posted_at=_first_text(item.get("datePosted") or item.get("validThrough")),
        tags=["jsonld"],
        raw=item,
        platform="hellowork",
        reliability="best_effort",
    )


def _offer_from_tree_row(base_url: str, row: dict) -> JobOffer | None:
    title = _first_text(row.get("title") or row.get("intitule") or row.get("name") or row.get("label"))
    url = _first_text(row.get("url") or row.get("link") or row.get("href") or row.get("applyUrl") or row.get("offerUrl"))
    if not title or not url:
        return None
    apply_url = urljoin(base_url, url)
    path = urlparse(apply_url).path
    if "hellowork.com" not in urlparse(apply_url).netloc and not url.startswith("/"):
        return None
    if "/emploi" not in path and "/offre" not in path:
        return None
    description = clean_text(strip_html_text(_first_text(row.get("description") or row.get("resume") or row.get("snippet"))))[:1600]
    return JobOffer(
        source="hellowork",
        source_job_id=_first_text(row.get("id") or row.get("reference")) or _source_id_from_url(apply_url),
        title=title,
        company=_first_text(row.get("company") or row.get("entreprise") or row.get("recruiter")),
        location=_first_text(row.get("location") or row.get("lieu") or row.get("city")),
        description=description,
        apply_url=apply_url,
        original_url=base_url,
        posted_at=_first_text(row.get("datePosted") or row.get("publishedAt") or row.get("updatedAt")),
        tags=["next_data"],
        raw=row,
        platform="hellowork",
        reliability="best_effort",
    )


def _offers_from_anchors(base_url: str, html: str) -> list[JobOffer]:
    offers: list[JobOffer] = []
    for match in re.finditer(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", html or "", flags=re.I | re.S):
        href, label = match.groups()
        apply_url = urljoin(base_url, unescape(href))
        path = urlparse(apply_url).path
        if "/fr-fr/emplois/" not in path and "/fr-fr/emploi/" not in path:
            continue
        title = clean_text(strip_html_text(label))[:220]
        if not title or len(title) < 4:
            continue
        offers.append(JobOffer(
            source="hellowork",
            source_job_id=_source_id_from_url(apply_url),
            title=title,
            apply_url=apply_url,
            original_url=base_url,
            description=title,
            tags=["html_link"],
            raw={"href": href, "title": title},
            platform="hellowork",
            reliability="best_effort",
        ))
    return offers


def offers_from_search_html(base_url: str, html: str) -> list[JobOffer]:
    offers: list[JobOffer] = []
    for block in _jsonld_blocks(html):
        for item in _flatten_json(block):
            raw_type = item.get("@type")
            types = raw_type if isinstance(raw_type, list) else [raw_type]
            if "JobPosting" not in {str(kind) for kind in types}:
                continue
            offer = _offer_from_jobposting(base_url, item)
            if offer:
                offers.append(offer)
    data = _next_data(html)
    if data is not None:
        for row in _iter_dicts(data):
            offer = _offer_from_tree_row(base_url, row)
            if offer:
                offers.append(offer)
    offers.extend(_offers_from_anchors(base_url, html))

    seen: set[str] = set()
    deduped: list[JobOffer] = []
    for offer in offers:
        key = offer.apply_url.lower().split("?", 1)[0]
        if key in seen:
            continue
        seen.add(key)
        deduped.append(offer)
    return deduped


async def scrape_target(target: str) -> list[dict]:
    url = _search_url(target)
    cached = _SEARCH_CACHE.get(url)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])
    html = await _fetch_html(url)
    if not html:
        return []
    leads = [
        offer_to_lead(offer)
        for offer in offers_from_search_html(url, html)
        if offer.title and offer.apply_url
    ]
    _SEARCH_CACHE[url] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
