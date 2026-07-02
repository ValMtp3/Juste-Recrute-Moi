from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET
from time import monotonic

import httpx

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text, is_recent
from discovery.sources.net import guarded_async_client

_SEARCH_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 600

def _parse_target(target: str) -> str:
    # Example: wttj:query=developpeur&department=75
    raw = target.split(":", 1)[1] if target.lower().startswith("wttj:") else target
    return raw

def _search_url(target: str) -> str:
    query = _parse_target(target)
    # query is likely directly a querystring
    return f"https://www.welcometothejungle.com/fr/jobs.rss?{query}"

async def _fetch_rss(url: str) -> str:
    headers = {
        "User-Agent": "Juste Recrute Moi WTTJ connector",
        "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    }
    async with guarded_async_client(timeout=httpx.Timeout(25.0), headers=headers, follow_redirects=True) as cx:
        response = await cx.get(url)
        if response.status_code == 429:
            await asyncio.sleep(int(response.headers.get("Retry-After", 5)))
            response = await cx.get(url)
        response.raise_for_status()
        return response.text

def _xml_text(node, tag: str) -> str:
    child = node.find(tag)
    return child.text.strip() if child is not None and child.text else ""

def offer_from_result(item: ET.Element) -> JobOffer | None:
    title = _xml_text(item, "title")
    link = _xml_text(item, "link")
    description = _xml_text(item, "description")
    pub_date = _xml_text(item, "pubDate")

    if not title or not link:
        return None

    company = ""
    # Usually "Job Title - Company Name" or "Company Name is hiring: Job Title"
    if " chez " in title:
        parts = title.split(" chez ")
        title = parts[0].strip()
        company = parts[-1].strip()
    elif " at " in title:
        parts = title.split(" at ")
        title = parts[0].strip()
        company = parts[-1].strip()

    return JobOffer(
        source="wttj",
        source_job_id=link,
        title=title,
        company=company,
        location="", # Often in the description or title
        remote=None,
        contract_type="",
        salary_min=None,
        salary_max=None,
        salary_currency="EUR",
        description=clean_text(description)[:1600],
        apply_url=link,
        original_url=link,
        posted_at=pub_date,
        tags=[],
        raw={"title": title, "link": link},
        platform="wttj",
        reliability="stable",
    )

async def scrape_target(target: str) -> list[dict]:
    url = _search_url(target)

    cache_key = url
    cached = _SEARCH_CACHE.get(cache_key)
    now = monotonic()
    if cached and cached[0] > now:
        return list(cached[1])

    try:
        xml_content = await _fetch_rss(url)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return []
        raise

    root = ET.fromstring(xml_content)
    items = root.findall(".//item")

    leads = []
    for item in items:
        offer = offer_from_result(item)
        if offer and offer.title and offer.apply_url:
            if offer.posted_at and not is_recent(offer.posted_at):
                continue
            leads.append(offer_to_lead(offer))

    _SEARCH_CACHE[cache_key] = (now + _CACHE_TTL_SECONDS, leads)
    return leads
