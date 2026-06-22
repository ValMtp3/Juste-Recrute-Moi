from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urljoin, urlparse

from discovery.job_offer import JobOffer, offer_to_lead
from discovery.normalizer import clean_text, strip_html_text
from discovery.sources.net import guarded_async_client


async def fetch_html(url: str) -> str:
    async with guarded_async_client(timeout=25, follow_redirects=True, headers={"User-Agent": "JustHireMe URL importer"}) as cx:
        response = await cx.get(url)
        response.raise_for_status()
        return response.text


def _jsonld_blocks(html: str) -> list[Any]:
    blocks: list[Any] = []
    for match in re.finditer(r"<script[^>]+type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", html or "", flags=re.I | re.S):
        raw = match.group(1).strip()
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return blocks


def _flatten_jsonld(value: Any) -> list[dict]:
    out: list[dict] = []
    if isinstance(value, dict):
        if isinstance(value.get("@graph"), list):
            for item in value["@graph"]:
                out.extend(_flatten_jsonld(item))
        out.append(value)
    elif isinstance(value, list):
        for item in value:
            out.extend(_flatten_jsonld(item))
    return out


def _first_text(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        for key in ("name", "value", "streetAddress", "addressLocality"):
            if value.get(key):
                return _first_text(value[key])
    if isinstance(value, list):
        return ", ".join(filter(None, (_first_text(item) for item in value)))
    return ""


def _jobposting_from_jsonld(url: str, html: str) -> JobOffer | None:
    for block in _jsonld_blocks(html):
        for item in _flatten_jsonld(block):
            raw_type = item.get("@type")
            types = raw_type if isinstance(raw_type, list) else [raw_type]
            if "JobPosting" not in {str(t) for t in types}:
                continue
            hiring = item.get("hiringOrganization") or {}
            location = item.get("jobLocation") or item.get("applicantLocationRequirements") or {}
            identifier = item.get("identifier") or {}
            apply_url = item.get("url") or item.get("sameAs") or url
            if isinstance(identifier, dict):
                source_id = _first_text(identifier.get("value") or identifier.get("name"))
            else:
                source_id = _first_text(identifier)
            salary = item.get("baseSalary") or {}
            value = salary.get("value") if isinstance(salary, dict) else {}
            salary_min = salary_max = None
            currency = salary.get("currency", "") if isinstance(salary, dict) else ""
            if isinstance(value, dict):
                raw_min = value.get("minValue") or value.get("value")
                raw_max = value.get("maxValue") or value.get("value")
                salary_min = float(raw_min) if raw_min not in (None, "") else None
                salary_max = float(raw_max) if raw_max not in (None, "") else None
            return JobOffer(
                source="url_import",
                source_job_id=source_id,
                title=_first_text(item.get("title")),
                company=_first_text(hiring.get("name") if isinstance(hiring, dict) else hiring),
                location=_first_text(location),
                remote=str(item.get("jobLocationType") or "").upper() == "TELECOMMUTE",
                contract_type=_first_text(item.get("employmentType")),
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=str(currency or ""),
                description=clean_text(strip_html_text(_first_text(item.get("description"))))[:1600],
                apply_url=urljoin(url, str(apply_url)),
                original_url=url,
                posted_at=_first_text(item.get("datePosted")),
                tags=["jsonld"],
                raw=item,
                platform=urlparse(url).netloc.replace("www.", "") or "url_import",
                reliability="manual",
            )
    return None


def _meta_content(html: str, name: str) -> str:
    pattern = rf"<meta[^>]+(?:property|name)=[\"']{re.escape(name)}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>"
    match = re.search(pattern, html or "", flags=re.I)
    return match.group(1).strip() if match else ""


def _fallback_offer(url: str, html: str) -> JobOffer:
    title = _meta_content(html, "og:title")
    if not title:
        match = re.search(r"<title[^>]*>(.*?)</title>", html or "", flags=re.I | re.S)
        title = strip_html_text(match.group(1)) if match else ""
    description = _meta_content(html, "og:description") or _meta_content(html, "description")
    if not description:
        body = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html or "", flags=re.I | re.S)
        description = strip_html_text(body)[:1600]
    host = urlparse(url).netloc.replace("www.", "")
    return JobOffer(
        source="url_import",
        title=clean_text(title)[:220] or "Imported job offer",
        company=host.split(".")[0].title() if host else "Imported",
        description=clean_text(description)[:1600],
        apply_url=url,
        original_url=url,
        platform=host or "url_import",
        reliability="manual",
        tags=["html_fallback"],
    )


def offer_from_html(url: str, html: str) -> JobOffer:
    return _jobposting_from_jsonld(url, html) or _fallback_offer(url, html)


async def import_url(url: str) -> dict:
    html = await fetch_html(url)
    return offer_to_lead(offer_from_html(url, html))


async def scrape_target(target: str) -> list[dict]:
    url = target.split(":", 1)[1].strip() if target.lower().startswith("import:") else target.strip()
    if not url:
        return []
    return [await import_url(url)]
