from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from discovery.lead_intel import canonical_lead_id, lead_id
from discovery.sources.common import text_lead

JobSource = Literal["france_travail", "jobspy", "ats", "url_import", "adzuna", "jooble", "wttj", "apec"]


@dataclass
class JobOffer:
    source: JobSource
    title: str
    apply_url: str
    source_job_id: str = ""
    company: str = ""
    location: str = ""
    remote: bool | None = None
    contract_type: str = ""
    salary_min: float | None = None
    salary_max: float | None = None
    salary_currency: str = ""
    description: str = ""
    original_url: str = ""
    posted_at: str = ""
    fetched_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tags: list[str] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)
    platform: str = ""
    reliability: Literal["stable", "best_effort", "manual"] = "best_effort"


def offer_to_lead(offer: JobOffer) -> dict:
    source_meta = {
        "source": offer.source,
        "source_job_id": offer.source_job_id,
        "remote": offer.remote,
        "contract_type": offer.contract_type,
        "salary_min": offer.salary_min,
        "salary_max": offer.salary_max,
        "salary_currency": offer.salary_currency,
        "original_url": offer.original_url,
        "posted_at": offer.posted_at,
        "fetched_at": offer.fetched_at,
        "tags": offer.tags,
        "raw": offer.raw,
        "source_reliability": offer.reliability,
    }
    job_id = lead_id(offer.source, offer.source_job_id) if offer.source_job_id else canonical_lead_id(offer.apply_url)
    lead = text_lead({
        "job_id": job_id,
        "title": offer.title,
        "company": offer.company,
        "url": offer.apply_url,
        "platform": offer.platform or offer.source,
        "description": offer.description,
        "posted_date": offer.posted_at,
        "location": offer.location,
        "budget": salary_label(offer),
        "source_meta": {key: value for key, value in source_meta.items() if value not in (None, "", [], {})},
    })
    return lead


def salary_label(offer: JobOffer) -> str:
    if offer.salary_min is None and offer.salary_max is None:
        return ""
    currency = offer.salary_currency or "EUR"
    if offer.salary_min is not None and offer.salary_max is not None and offer.salary_min != offer.salary_max:
        return f"{offer.salary_min:g}-{offer.salary_max:g} {currency}"
    amount = offer.salary_min if offer.salary_min is not None else offer.salary_max
    return f"{amount:g} {currency}" if amount is not None else ""
