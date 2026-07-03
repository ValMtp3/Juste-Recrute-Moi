from __future__ import annotations
import logging
import re
import unicodedata

from datetime import datetime, timezone
from urllib.parse import unquote_plus, urlparse

from discovery.normalizer import clean_text, is_recent, strip_html_text
from discovery.sources.common import json_get, text_lead, xml_get

# Keyless, direct public JSON/XML job-board APIs. Preferred over the fragile
# Google-dork -> browser -> LLM path: no key, no browser, stable schema.
_ATS_HOSTS = (
    "greenhouse.io",
    "lever.co",
    "ashbyhq.com",
    "workable.com",
    "smartrecruiters.com",
    "teamtailor.com",
    "recruitee.com",
    "jobs.personio.",  # {slug}.jobs.personio.com / .de
)


def is_ats_target(target: str) -> bool:
    lower = target.lower()
    if lower.startswith("ats:"):
        return True
    if not lower.startswith(("http://", "https://")):
        return False
    host = urlparse(target).hostname or ""
    return any((domain in host) if domain.endswith(".") else _host_is(host, domain) for domain in _ATS_HOSTS)


def _host_is(host: str, domain: str) -> bool:
    host = host.lower()
    return host == domain or host.endswith(f".{domain}")


_FILTER_STOPWORDS = {
    "a",
    "and",
    "au",
    "aux",
    "de",
    "des",
    "du",
    "en",
    "et",
    "for",
    "la",
    "le",
    "les",
    "of",
    "pour",
    "the",
}

_ROLE_ALIASES = {
    "ai": ("ai", "ia", "machine learning", "ml"),
    "back": ("back", "backend", "back end", "server"),
    "backend": ("backend", "back end", "server"),
    "commercial": ("commercial", "sales", "business developer", "business development"),
    "data": ("data",),
    "developpeur": ("developpeur", "developer", "software engineer", "ingenieur logiciel"),
    "developer": ("developer", "developpeur", "software engineer", "ingenieur logiciel"),
    "devops": ("devops", "sre", "platform engineer"),
    "front": ("front", "frontend", "front end"),
    "frontend": ("frontend", "front end"),
    "ia": ("ia", "ai", "machine learning", "ml"),
    "ingenieur": ("ingenieur", "engineer"),
    "marketing": ("marketing", "growth"),
    "product": ("product", "produit"),
    "sales": ("sales", "commercial", "business developer", "business development"),
}

_CONTRACT_TERMS = {
    "APP": ("alternance", "apprentissage", "apprenticeship"),
    "CDD": ("cdd", "fixed term", "fixed-term"),
    "CDI": ("cdi", "permanent", "full time", "full-time"),
    "LIB": ("freelance", "contractor", "independent"),
    "MIS": ("stage", "internship", "intern"),
}

_REMOTE_TERMS = ("remote", "hybrid", "teletravail", "work from home", "wfh")


def _normalize_filter_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9+#.]+", " ", without_accents.lower()).strip()


def _contains_term(text: str, term: str) -> bool:
    normalized = _normalize_filter_text(term)
    if not normalized:
        return False
    if " " in normalized:
        return normalized in text
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(normalized)}(?![a-z0-9])", text))


def _lead_filter_text(lead: dict) -> str:
    meta = lead.get("source_meta") if isinstance(lead.get("source_meta"), dict) else {}
    meta_text = " ".join(str(value) for value in meta.values() if isinstance(value, (str, int, float)))
    return _normalize_filter_text("\n".join([
        str(lead.get("title") or ""),
        str(lead.get("company") or ""),
        str(lead.get("location") or ""),
        str(lead.get("description") or ""),
        meta_text,
    ]))


def _query_token_groups(query: str) -> list[tuple[str, ...]]:
    tokens = [
        token
        for token in _normalize_filter_text(query).split()
        if token not in _FILTER_STOPWORDS and (len(token) >= 3 or token in _ROLE_ALIASES)
    ]
    return [tuple(_ROLE_ALIASES.get(token, (token,))) for token in tokens]


def _target_param(params: dict[str, str], *names: str) -> str:
    for name in names:
        value = params.get(name.lower())
        if value:
            return value
    return ""


def _truthy_param(value: str) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def _matches_query_filter(lead: dict, query: str) -> bool:
    groups = _query_token_groups(query)
    if not groups:
        return True
    text = _lead_filter_text(lead)
    return any(any(_contains_term(text, term) for term in group) for group in groups)


def _matches_location_filter(lead: dict, location: str, remote_allowed: bool) -> bool:
    normalized = _normalize_filter_text(location)
    if not normalized or normalized == "france":
        return True
    text = _lead_filter_text(lead)
    if _contains_term(text, normalized):
        return True
    return remote_allowed and any(_contains_term(text, term) for term in _REMOTE_TERMS)


def _matches_contract_filter(lead: dict, contract: str) -> bool:
    normalized = _normalize_filter_text(contract).upper()
    if not normalized:
        return True
    terms = _CONTRACT_TERMS.get(normalized, (normalized.lower(),))
    text = _lead_filter_text(lead)
    return any(_contains_term(text, term) for term in terms)


def _matches_remote_filter(lead: dict, remote: bool) -> bool:
    if not remote:
        return True
    text = _lead_filter_text(lead)
    return any(_contains_term(text, term) for term in _REMOTE_TERMS)


def _parse_ats_target(target: str) -> tuple[str, str, dict[str, str]]:
    parts = str(target or "").strip().split(":", 2)
    if len(parts) < 3 or parts[0].lower() != "ats":
        return "", "", {}
    provider = parts[1].strip().lower()
    chunks = [chunk.strip() for chunk in parts[2].replace("|", ";").split(";") if chunk.strip()]
    if not chunks:
        return provider, "", {}
    params: dict[str, str] = {}
    for chunk in chunks[1:]:
        if "=" not in chunk:
            continue
        key, value = chunk.split("=", 1)
        params[key.strip().lower()] = unquote_plus(value.strip())
    return provider, chunks[0], params


def _filter_target_leads(leads: list[dict], params: dict[str, str]) -> list[dict]:
    query = _target_param(params, "query", "role", "q")
    location = _target_param(params, "location", "lieu", "where", "aroundQuery")
    contract = _target_param(params, "typeContrat", "contract", "contrat")
    remote = _truthy_param(_target_param(params, "remote", "teletravail"))
    if not any((query, location, contract, remote)):
        return leads

    results: list[dict] = []
    for lead in leads:
        if not _matches_query_filter(lead, query):
            continue
        if not _matches_location_filter(lead, location, remote):
            continue
        if not _matches_contract_filter(lead, contract):
            continue
        if not _matches_remote_filter(lead, remote):
            continue
        meta = dict(lead.get("source_meta") or {})
        if query:
            meta.setdefault("target_query", query)
        if location:
            meta.setdefault("target_location", location)
        if contract:
            meta.setdefault("target_contract", contract)
        if remote:
            meta.setdefault("target_remote", "true")
        results.append({**lead, "source_meta": meta})
    return results


async def scrape_greenhouse(slug: str) -> list[dict]:
    data = await json_get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs", {"content": "true"})
    if not isinstance(data, dict):
        return []
    results = []
    for job in data.get("jobs", []):
        # A single non-dict element (proxy/CDN-mangled response) must not abort the
        # whole board — skip it and keep the valid postings. (Mirrors scrape_workable.)
        if not isinstance(job, dict):
            continue
        updated = job.get("updated_at") or ""
        if updated and not is_recent(updated):
            continue
        desc = strip_html_text(job.get("content") or "")
        loc_field = job.get("location")
        location = ", ".join(
            loc.get("name", "")
            for loc in (job.get("offices") or [])
            if isinstance(loc, dict) and loc.get("name")
        ) or (loc_field.get("name", "") if isinstance(loc_field, dict) else "")
        if location:
            desc = (desc + f"\nLocation: {location}").strip()
        results.append(text_lead({
            "title": job.get("title", ""),
            "company": slug,
            "url": job.get("absolute_url", ""),
            "platform": "greenhouse",
            "description": desc[:1200],
            "posted_date": updated,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "greenhouse", "slug": slug},
        }))
    return results


async def scrape_lever(slug: str) -> list[dict]:
    data = await json_get(f"https://api.lever.co/v0/postings/{slug}", {"mode": "json"})
    results = []
    for job in data if isinstance(data, list) else []:
        if not isinstance(job, dict):
            continue
        created = ""
        if job.get("createdAt"):
            try:
                created = datetime.fromtimestamp(int(job["createdAt"]) / 1000, tz=timezone.utc).isoformat()
            except Exception as log_exc:
                logging.getLogger(__name__).warning('suppressed exception in backend/discovery/sources/ats.py:scrape_lever: %s', log_exc)
                created = str(job.get("createdAt"))
        if created and not is_recent(created):
            continue
        parts = [
            job.get("descriptionPlain", ""),
            job.get("additionalPlain", ""),
            " ".join(str(x) for x in (job.get("categories") or {}).values() if x),
        ]
        results.append(text_lead({
            "title": job.get("text", ""),
            "company": slug,
            "url": job.get("hostedUrl", ""),
            "platform": "lever",
            "description": clean_text("\n".join(parts))[:1200],
            "posted_date": created,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "lever", "slug": slug},
        }))
    return results


async def scrape_ashby(slug: str) -> list[dict]:
    data = await json_get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    results = []
    for job in jobs:
        if not isinstance(job, dict):
            continue
        posted = job.get("publishedDate") or job.get("updatedAt") or ""
        if posted and not is_recent(posted):
            continue
        desc = strip_html_text(job.get("descriptionHtml") or job.get("descriptionPlain") or "")
        location = job.get("locationName") or ""
        if location:
            desc = (desc + f"\nLocation: {location}").strip()
        url = job.get("jobUrl") or job.get("applyUrl") or f"https://jobs.ashbyhq.com/{slug}/{job.get('id', '')}"
        results.append(text_lead({
            "title": job.get("title", ""),
            "company": slug,
            "url": url,
            "platform": "ashby",
            "description": desc[:1200],
            "posted_date": posted,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "ashby", "slug": slug},
        }))
    return results


async def scrape_workable(slug: str) -> list[dict]:
    try:
        data = await json_get(f"https://www.workable.com/api/accounts/{slug}", {"details": "true"})
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/discovery/sources/ats.py:scrape_workable: %s', log_exc)
        data = await json_get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}")

    if isinstance(data, list):
        jobs = data
    elif isinstance(data, dict):
        jobs = data.get("jobs") or data.get("results") or data.get("positions") or []
    else:
        jobs = []

    results = []
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        posted = (
            job.get("published_on")
            or job.get("published")
            or job.get("created_at")
            or job.get("updated_at")
            or ""
        )
        if posted and not is_recent(posted):
            continue
        location_data = job.get("location") or {}
        if isinstance(location_data, dict):
            location = ", ".join(str(x) for x in location_data.values() if x)
        else:
            location = str(location_data or "")
        desc = clean_text("\n".join([
            strip_html_text(job.get("description") or job.get("full_description") or ""),
            strip_html_text(job.get("requirements") or ""),
            strip_html_text(job.get("benefits") or ""),
            f"Location: {location}" if location else "",
        ]))
        code = job.get("shortcode") or job.get("code") or job.get("id") or ""
        url = (
            job.get("url")
            or job.get("application_url")
            or job.get("shortlink")
            or (f"https://apply.workable.com/{slug}/j/{code}/" if code else f"https://apply.workable.com/{slug}/")
        )
        results.append(text_lead({
            "title": job.get("title") or job.get("full_title") or "",
            "company": slug,
            "url": url,
            "platform": "workable",
            "description": desc[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "workable", "slug": slug},
        }))
    return results


async def scrape_smartrecruiters(slug: str) -> list[dict]:
    data = await json_get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings", {"limit": "100"})
    jobs = data.get("content") if isinstance(data, dict) else []
    results = []
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        posted = job.get("releasedDate") or job.get("updatedOn") or job.get("createdOn") or ""
        if posted and not is_recent(posted):
            continue
        location_data = job.get("location") or {}
        location = ", ".join(
            str(location_data.get(key) or "")
            for key in ("city", "region", "country")
            if location_data.get(key)
        ) if isinstance(location_data, dict) else str(location_data or "")
        url = job.get("ref") or job.get("applyUrl") or f"https://jobs.smartrecruiters.com/{slug}/{job.get('id', '')}"
        desc = clean_text(strip_html_text(job.get("jobAd", {}).get("sections", {}).get("jobDescription", "") if isinstance(job.get("jobAd"), dict) else ""))
        if location:
            desc = (desc + f"\nLocation: {location}").strip()
        results.append(text_lead({
            "title": job.get("name") or job.get("title") or "",
            "company": slug,
            "url": url,
            "platform": "smartrecruiters",
            "description": desc[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "smartrecruiters", "slug": slug, "source_job_id": job.get("id")},
        }))
    return results


async def scrape_teamtailor(slug: str) -> list[dict]:
    data = await json_get(f"https://{slug}.teamtailor.com/jobs.json")
    jobs = data.get("jobs") if isinstance(data, dict) else data
    results = []
    for job in jobs if isinstance(jobs, list) else []:
        if not isinstance(job, dict):
            continue
        posted = job.get("published_at") or job.get("updated_at") or ""
        if posted and not is_recent(posted):
            continue
        location_data = job.get("locations") or job.get("location") or []
        if isinstance(location_data, list):
            location = ", ".join(str(loc.get("name") if isinstance(loc, dict) else loc) for loc in location_data if loc)
        elif isinstance(location_data, dict):
            location = str(location_data.get("name") or "")
        else:
            location = str(location_data or "")
        url = job.get("url") or job.get("careersite_job_url") or f"https://{slug}.teamtailor.com/jobs/{job.get('id', '')}"
        desc = clean_text(strip_html_text(job.get("body") or job.get("description") or job.get("pitch") or ""))
        if location:
            desc = (desc + f"\nLocation: {location}").strip()
        results.append(text_lead({
            "title": job.get("title") or job.get("name") or "",
            "company": slug,
            "url": url,
            "platform": "teamtailor",
            "description": desc[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"source": "ats", "source_reliability": "stable", "ats": "teamtailor", "slug": slug, "source_job_id": job.get("id")},
        }))
    return results


async def scrape_smartrecruiters(slug: str) -> list[dict]:
    data = await json_get(
        f"https://api.smartrecruiters.com/v1/companies/{slug}/postings", {"limit": "100"}
    )
    postings = data.get("content", []) if isinstance(data, dict) else []
    results = []
    for job in postings if isinstance(postings, list) else []:
        if not isinstance(job, dict):
            continue
        posted = job.get("releasedDate") or ""
        if posted and not is_recent(posted):
            continue
        loc = job.get("location") or {}
        location = ", ".join(
            str(loc.get(k, "")) for k in ("city", "region", "country")
            if isinstance(loc, dict) and loc.get(k)
        )
        company = (job.get("company") or {}).get("name") if isinstance(job.get("company"), dict) else ""
        job_id = str(job.get("id") or "")
        url = f"https://jobs.smartrecruiters.com/{slug}/{job_id}" if job_id else f"https://jobs.smartrecruiters.com/{slug}"
        desc = job.get("name", "")
        if location:
            desc = (desc + f"\nLocation: {location}").strip()
        results.append(text_lead({
            "title": job.get("name", ""),
            "company": company or slug,
            "url": url,
            "platform": "smartrecruiters",
            "description": desc[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"ats": "smartrecruiters", "slug": slug},
        }))
    return results


async def scrape_recruitee(slug: str) -> list[dict]:
    data = await json_get(f"https://{slug}.recruitee.com/api/offers/")
    offers = data.get("offers", []) if isinstance(data, dict) else []
    results = []
    for job in offers if isinstance(offers, list) else []:
        if not isinstance(job, dict):
            continue
        posted = job.get("published_at") or job.get("created_at") or ""
        if posted and not is_recent(posted):
            continue
        location = ", ".join(
            str(job.get(k, "")) for k in ("city", "country") if job.get(k)
        ) or str(job.get("location") or "")
        desc = clean_text("\n".join([
            strip_html_text(job.get("description") or ""),
            strip_html_text(job.get("requirements") or ""),
            f"Location: {location}" if location else "",
        ]))
        url = (
            job.get("careers_url")
            or job.get("careers_apply_url")
            or f"https://{slug}.recruitee.com/o/{job.get('slug', '')}"
        )
        results.append(text_lead({
            "title": job.get("title", ""),
            "company": job.get("company_name") or slug,
            "url": url,
            "platform": "recruitee",
            "description": desc[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"ats": "recruitee", "slug": slug},
        }))
    return results


async def scrape_personio(slug: str, tld: str = "") -> list[dict]:
    """Scrape a Personio tenant. With no explicit TLD (the watchlist / ats: form
    carries none), try .com then .de so a .de-only tenant isn't silently missed."""
    candidates = [tld.lstrip(".")] if tld else ["com", "de"]
    for candidate in candidates:
        results = await _scrape_personio_at(slug, candidate)
        if results:
            return results
    return []


async def _scrape_personio_at(slug: str, tld: str) -> list[dict]:
    from defusedxml import ElementTree as DefusedET

    tld = (tld or "com").lstrip(".")
    base = f"https://{slug}.jobs.personio.{tld}"
    xml = await xml_get(f"{base}/xml")
    try:
        root = DefusedET.fromstring(xml)
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/discovery/sources/ats.py:scrape_personio: %s', log_exc)
        return []
    results = []
    for pos in root.iter("position"):
        def _text(tag: str, node=pos) -> str:
            el = node.find(tag)
            return (el.text or "").strip() if el is not None and el.text else ""

        posted = _text("createdAt")
        if posted and not is_recent(posted):
            continue
        title = _text("name")
        location = _text("office")
        desc_parts = [title]
        for jd in pos.iter("jobDescription"):
            value = jd.find("value")
            if value is not None and value.text:
                desc_parts.append(strip_html_text(value.text))
        if location:
            desc_parts.append(f"Location: {location}")
        job_id = _text("id")
        url = f"{base}/job/{job_id}" if job_id else f"{base}/"
        results.append(text_lead({
            "title": title,
            "company": slug,
            "url": url,
            "platform": "personio",
            "description": clean_text("\n".join(desc_parts))[:1200],
            "posted_date": posted,
            "location": location,
            "source_meta": {"ats": "personio", "slug": slug},
        }))
    return results


async def scrape_direct_ats_url(url: str) -> list[dict]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    subdomain = host.split(".")[0]
    path = parsed.path.strip("/").split("/")
    if _host_is(host, "greenhouse.io") and path:
        return await scrape_greenhouse(path[0])
    if _host_is(host, "lever.co") and path:
        return await scrape_lever(path[0])
    if _host_is(host, "ashbyhq.com") and path:
        return await scrape_ashby(path[0])
    if _host_is(host, "workable.com") and path:
        slug = path[0] if path[0] not in {"j", "api"} else ""
        if slug:
            return await scrape_workable(slug)
    if "smartrecruiters.com" in host:
        # jobs.smartrecruiters.com/{company}/... or api.smartrecruiters.com/v1/companies/{company}/...
        if "companies" in path:
            idx = path.index("companies")
            if idx + 1 < len(path):
                return await scrape_smartrecruiters(path[idx + 1])
        elif path and path[0]:
            return await scrape_smartrecruiters(path[0])
        return []
    if _host_is(host, "teamtailor.com"):
        slug = host.split(".teamtailor.com")[0].replace("www.", "")
        if slug:
            return await scrape_teamtailor(slug)
    if "recruitee.com" in host and subdomain not in {"www", ""}:
        return await scrape_recruitee(subdomain)
    if "jobs.personio." in host and subdomain not in {"www", ""}:
        # Preserve the tenant's real TLD (.com / .de) instead of hardcoding .com.
        return await scrape_personio(subdomain, host.rsplit(".", 1)[-1] or "com")
    return []


async def scrape_target(target: str) -> list[dict]:
    lower = target.lower()
    if lower.startswith("ats:greenhouse:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_greenhouse(slug), params)
    if lower.startswith("ats:lever:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_lever(slug), params)
    if lower.startswith("ats:ashby:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_ashby(slug), params)
    if lower.startswith("ats:workable:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_workable(slug), params)
    if lower.startswith("ats:smartrecruiters:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_smartrecruiters(slug), params)
    if lower.startswith("ats:teamtailor:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_teamtailor(slug), params)
    if lower.startswith("ats:recruitee:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_recruitee(slug), params)
    if lower.startswith("ats:personio:"):
        _, slug, params = _parse_ats_target(target)
        return _filter_target_leads(await scrape_personio(slug), params)
    if lower.startswith(("http://", "https://")):
        return await scrape_direct_ats_url(target)
    return []
