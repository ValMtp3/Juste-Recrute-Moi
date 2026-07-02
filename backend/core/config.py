from __future__ import annotations
import logging

import os
import re
from dataclasses import dataclass
from urllib.parse import urlencode


DEFAULT_JOB_TARGETS = [
    "france_travail:developpeur;lieu=France;range=0-49",
    "site:hellowork.com/fr-fr/emplois France",
    "site:cadremploi.fr/emploi France",
    "site:meteojob.com/jobs France",
    "site:lesjeudis.com/jobs France",
    "site:linkedin.com/jobs France",
    "site:fr.indeed.com/emplois France",
    "site:talent.com/fr France",
    "site:chooseyourboss.com France",
    "site:jobs.smartrecruiters.com France",
    "site:teamtailor.com/jobs France",
    "site:boards.greenhouse.io France",
    "site:jobs.lever.co France",
    "site:jobs.ashbyhq.com France",
    "site:apply.workable.com France",
]

INDIA_JOB_TARGETS = [
    "site:wellfound.com/jobs India",
    "site:cutshort.io/jobs India startup",
    "site:instahyre.com jobs India",
    "site:naukri.com jobs India",
    "site:foundit.in jobs India",
    "site:internshala.com/jobs India",
    "site:linkedin.com/jobs India",
    "site:indeed.com/jobs India",
    "site:glassdoor.co.in Job India",
    "site:boards.greenhouse.io India",
    "site:jobs.lever.co India",
    "site:jobs.ashbyhq.com India",
    "site:apply.workable.com India",
]

FRANCE_DIRECT_SOURCE_TARGETS = [
    "france_travail:developpeur;lieu=France;range=0-49",
    "wttj:query=developpeur&aroundQuery=France",
    "apec:developpeur;location=France",
    "adzuna:developpeur;location=France;results=50",
    "jooble:developpeur;location=France",
]

FRANCE_SITE_TARGETS = [
    "site:hellowork.com/fr-fr/emplois France",
    "site:cadremploi.fr/emploi France",
    "site:meteojob.com/jobs France",
    "site:lesjeudis.com/jobs France",
    "site:welcometothejungle.com/fr/jobs France",
    "site:apec.fr/candidat/recherche-emploi.html/emploi France",
    "site:linkedin.com/jobs France",
    "site:fr.indeed.com/emplois France",
    "site:talent.com/fr France",
    "site:chooseyourboss.com France",
    "site:jobs.smartrecruiters.com France",
    "site:teamtailor.com/jobs France",
    "site:boards.greenhouse.io France",
    "site:jobs.lever.co France",
    "site:jobs.ashbyhq.com France",
    "site:apply.workable.com France",
]

FRANCE_JOB_TARGETS = [*FRANCE_DIRECT_SOURCE_TARGETS, *FRANCE_SITE_TARGETS]

GENERIC_FRANCE_TRAVAIL_ROLES = {
    "developpeur",
    "développeur",
    "developer",
}

CONFIGURED_TARGET_PREFIXES = (
    "http://",
    "https://",
    "site:",
    "ats:",
    "france_travail:",
    "jobspy:",
    "adzuna:",
    "jooble:",
    "wttj:",
    "apec:",
    "import:",
    "github:",
    "hn:",
    "reddit:",
)

FRANCE_LOCATION_HINTS = {
    "france",
    "paris",
    "lyon",
    "marseille",
    "lille",
    "nantes",
    "bordeaux",
    "toulouse",
    "rennes",
    "strasbourg",
    "montpellier",
    "nice",
    "grenoble",
    "rouen",
    "reims",
    "dijon",
}

FRANCE_CONTRACT_ALIASES = {
    "cdi": "CDI",
    "cdd": "CDD",
    "stage": "MIS",
    "internship": "MIS",
    "alternance": "APP",
    "apprentissage": "APP",
    "freelance": "LIB",
    "independant": "LIB",
    "indépendant": "LIB",
}

REMOTE_TERMS = (
    "full remote",
    "100% remote",
    "100 remote",
    "télétravail",
    "teletravail",
    "remotely",
    "remote",
)

SEARCH_STOPWORDS = {"a", "à", "au", "aux", "en", "in", "sur", "near", "around", "autour", "de", "d"}


@dataclass(frozen=True)
class SearchIntent:
    role: str = ""
    location: str = ""
    contract: str = ""
    remote: bool = False

BLOCKED_JOB_TARGET_MARKERS = (
    "freelance",
    "upwork",
    "freelancer.com",
    "fiverr",
    "contra.com",
    "peopleperhour",
    "guru.com",
    "truelancer",
    "codementor",
    "toptal",
)


def split_configured_targets(raw: str) -> list[str]:
    targets: list[str] = []
    for line in str(raw or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        for part in line.split(","):
            target = part.strip()
            if target and not target.startswith("#"):
                targets.append(target)
    return targets


def dedupe_targets(targets: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for target in targets:
        key = target.strip().lower()
        if key and key not in seen:
            seen.add(key)
            out.append(target.strip())
    return out


def _is_configured_target(value: str) -> bool:
    lower = value.strip().lower()
    return lower.startswith(CONFIGURED_TARGET_PREFIXES)


def _clean_france_travail_value(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[;|=]+", " ", str(value or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or fallback


def _clean_target_value(value: str, fallback: str) -> str:
    cleaned = re.sub(r"[;|=]+", " ", str(value or "")).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned or fallback


def _is_generic_france_travail_target(target: str) -> bool:
    lower = str(target or "").strip().lower()
    if not lower.startswith("france_travail:"):
        return False
    body = lower.split(":", 1)[1]
    parts = [part.strip() for part in body.replace("|", ";").split(";") if part.strip()]
    role = parts[0] if parts and "=" not in parts[0] else ""
    params: dict[str, str] = {}
    for part in parts[1:] if role else parts:
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        params[key.strip()] = value.strip()
    location = params.get("lieu") or params.get("location") or ""
    has_specific_filter = any(key in params for key in ("typecontrat", "contrat", "teletravail", "rayon"))
    return role in GENERIC_FRANCE_TRAVAIL_ROLES and location in {"", "france"} and not has_specific_filter


def _france_direct_prefix(target: str) -> str:
    lower = str(target or "").strip().lower()
    for prefix in ("france_travail", "wttj", "apec", "adzuna", "jooble"):
        if lower.startswith(f"{prefix}:"):
            return prefix
    return ""


def _is_generic_france_direct_target(target: str) -> bool:
    prefix = _france_direct_prefix(target)
    if not prefix:
        return False
    if prefix == "france_travail":
        return _is_generic_france_travail_target(target)
    lower = str(target or "").strip().lower()
    return any(role in lower for role in GENERIC_FRANCE_TRAVAIL_ROLES) and "france" in lower


def _norm_token(value: str) -> str:
    return re.sub(r"[^\w%]+", " ", str(value or "").lower(), flags=re.UNICODE).strip()


def _canonical_france_location(value: str) -> str:
    cleaned = _clean_france_travail_value(value, "France")
    key = _norm_token(cleaned)
    if key in FRANCE_LOCATION_HINTS:
        return " ".join(part.capitalize() for part in cleaned.split())
    return cleaned


def _is_country_wide_france_location(value: str) -> bool:
    return _norm_token(value) in {"", "france"}


def _normalize_radius_km(value, default: str = "") -> str:
    text = str(value or "").strip()
    if not text:
        return default
    try:
        radius = int(float(text.replace(",", ".")))
    except (TypeError, ValueError):
        return default
    return str(max(0, min(radius, 100)))


def _secondary_france_role_variant(role: str) -> str:
    cleaned = _clean_target_value(role, "")
    words = [word for word in re.split(r"\s+", cleaned) if word]
    if len(words) < 2:
        return ""
    first = _norm_token(words[0])
    if first in {"chef"} and len(words) >= 3 and _norm_token(words[1]) == "de":
        return " ".join(words[:3])
    if first in {
        "developpeur",
        "développeur",
        "developer",
        "ingenieur",
        "ingénieur",
        "commercial",
        "designer",
        "product",
        "data",
        "devops",
    }:
        return words[0]
    if len(words) >= 3:
        return " ".join(words[:2])
    return ""


def _extract_contract(chunks: list[str]) -> tuple[str, list[str]]:
    for chunk in chunks:
        norm = _norm_token(chunk)
        for alias, value in FRANCE_CONTRACT_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", norm):
                remaining = [
                    re.sub(rf"\b{re.escape(alias)}\b", " ", item, flags=re.IGNORECASE).strip()
                    for item in chunks
                ]
                return value, [item for item in remaining if item]
    return "", chunks


def _extract_remote(chunks: list[str]) -> tuple[bool, list[str]]:
    out: list[str] = []
    found = False
    for chunk in chunks:
        value = chunk
        norm = _norm_token(value)
        for term in REMOTE_TERMS:
            if term in norm:
                found = True
                value = re.sub(re.escape(term), " ", value, flags=re.IGNORECASE)
        value = re.sub(r"\s+", " ", value).strip()
        if value:
            out.append(value)
    return found, out


def parse_search_intent(parts: list[str], fallback_location: str = "France") -> SearchIntent | None:
    """Parse a free-form France search into role/location/contract hints.

    This is deliberately deterministic: the LLM still plans broad `site:`
    queries, but France Travail needs explicit API parameters.
    """
    chunks: list[str] = []
    for part in parts:
        if _is_configured_target(part):
            return None
        chunks.extend(item.strip() for item in re.split(r"[,|;]", part) if item.strip())
    if not chunks:
        return None

    contract, chunks = _extract_contract(chunks)
    remote, chunks = _extract_remote(chunks)
    location = fallback_location or "France"
    role_chunks: list[str] = []
    for chunk in chunks:
        words = [w for w in re.split(r"\s+", chunk) if w]
        kept: list[str] = []
        for word in words:
            key = _norm_token(word)
            if key in FRANCE_LOCATION_HINTS:
                location = _canonical_france_location(word)
            elif key not in SEARCH_STOPWORDS:
                kept.append(word)
            else:
                continue
        if kept:
            role_chunks.append(" ".join(kept))

    role = _clean_france_travail_value(" ".join(role_chunks), "developpeur")
    location = _canonical_france_location(location)
    return SearchIntent(role=role, location=location, contract=contract, remote=remote)


def france_travail_target_from_plain(
    parts: list[str],
    fallback_location: str = "France",
    radius_km: str = "",
) -> str | None:
    """Convert simple France search text like "data, paris" into an API target."""
    intent = parse_search_intent(parts, fallback_location)
    if not intent:
        return None
    query = _clean_france_travail_value(intent.role, "developpeur")
    location = _clean_france_travail_value(intent.location, "France")
    suffix = ""
    radius = _normalize_radius_km(radius_km)
    if radius and not _is_country_wide_france_location(location):
        suffix += f";rayon={radius}"
    if intent.remote:
        suffix += ";teletravail=1"
    if intent.contract:
        suffix += f";typeContrat={intent.contract}"
    location = _clean_france_travail_value(location, "France")
    return f"france_travail:{query};lieu={location};range=0-49{suffix}"


def job_market_focus(value) -> str:
    focus = str(value or "global").strip().lower()
    if focus in {"india", "in", "indian", "indian_startups"}:
        return "india"
    if focus in {"france", "fr", "french", "marche_francais", "marché_français"}:
        return "france"
    return "global"


def is_hn_target(target: str) -> bool:
    lower = target.lower()
    return lower.startswith("hn:") or "hn-hiring" in lower or "hackernews" in lower or "news.ycombinator.com" in lower


def _france_direct_targets(
    role: str,
    location: str,
    *,
    radius_km: str = "",
    contract: str = "",
    remote: bool = False,
    include_france_travail: bool = True,
) -> list[str]:
    query = _clean_target_value(role, "developpeur")
    location = _canonical_france_location(location or "France")
    suffix = ""
    radius = _normalize_radius_km(radius_km)
    if radius and not _is_country_wide_france_location(location):
        suffix += f";rayon={radius}"
    if remote:
        suffix += ";teletravail=1"
    if contract:
        suffix += f";typeContrat={contract}"
    wttj_query = urlencode({"query": query, "aroundQuery": location})
    targets = [
        f"france_travail:{query};lieu={_clean_france_travail_value(location, 'France')};range=0-49{suffix}",
        f"wttj:{wttj_query}",
        f"apec:{query};location={location}",
        f"adzuna:{query};location={location};results=50",
        f"jooble:{query};location={location}",
    ]
    return targets if include_france_travail else targets[1:]


def _france_direct_targets_for_intent(
    role: str,
    location: str,
    *,
    radius_km: str = "",
    contract: str = "",
    remote: bool = False,
) -> list[str]:
    targets = _france_direct_targets(
        role,
        location,
        radius_km=radius_km,
        contract=contract,
        remote=remote,
    )
    broader_role = _secondary_france_role_variant(role)
    if broader_role and _norm_token(broader_role) != _norm_token(role):
        targets.extend(_france_direct_targets(
            broader_role,
            location,
            radius_km=radius_km,
            contract=contract,
            remote=remote,
            include_france_travail=False,
        ))
    return dedupe_targets(targets)


def _france_targets_from_intent(
    search_text: str,
    fallback_location: str = "France",
    radius_km: str = "",
) -> list[str]:
    intent = parse_search_intent([search_text], fallback_location) if str(search_text or "").strip() else None
    if intent:
        return [
            *_france_direct_targets_for_intent(
                intent.role,
                intent.location,
                radius_km=radius_km,
                contract=intent.contract,
                remote=intent.remote,
            ),
            *FRANCE_SITE_TARGETS,
        ]
    if fallback_location and fallback_location.lower() != "france":
        return [
            *_france_direct_targets("developpeur", fallback_location, radius_km=radius_km),
            *FRANCE_SITE_TARGETS,
        ]
    return list(FRANCE_JOB_TARGETS)


def job_targets(
    raw: str,
    market_focus: str = "global",
    *,
    search_text: str = "",
    location: str = "",
    radius_km: str = "",
) -> list[str]:
    focus = job_market_focus(market_focus)
    targets = split_configured_targets(raw)
    if not targets:
        if focus == "india":
            return list(INDIA_JOB_TARGETS)
        if focus == "france":
            return _france_targets_from_intent(search_text, location or "France", radius_km)
        return list(DEFAULT_JOB_TARGETS)

    if focus == "france":
        plain_france_target = france_travail_target_from_plain(targets, location or "France", radius_km)
        if plain_france_target:
            intent = parse_search_intent(targets, location or "France")
            if intent:
                targets = [
                    *_france_direct_targets_for_intent(
                        intent.role,
                        intent.location,
                        radius_km=radius_km,
                        contract=intent.contract,
                        remote=intent.remote,
                    ),
                    *FRANCE_SITE_TARGETS,
                ]
            else:
                targets = [plain_france_target, *FRANCE_JOB_TARGETS[1:]]
        elif str(search_text or "").strip() and any(_is_generic_france_travail_target(target) for target in targets):
            profile_france_targets = _france_targets_from_intent(search_text, location or "France", radius_km)
            direct_replacements = {
                _france_direct_prefix(target): target
                for target in profile_france_targets[:len(FRANCE_DIRECT_SOURCE_TARGETS)]
                if _france_direct_prefix(target)
            }
            if direct_replacements:
                targets = [
                    direct_replacements.get(_france_direct_prefix(target), target)
                    if _is_generic_france_direct_target(target) else target
                    for target in targets
                ]

    filtered: list[str] = []
    for target in targets:
        lower = target.lower()
        if any(marker in lower for marker in BLOCKED_JOB_TARGET_MARKERS):
            continue
        filtered.append(target)

    if focus == "global" and filtered and all(is_hn_target(target) for target in filtered):
        filtered.extend(["https://remoteok.com/api", "site:jobs.lever.co", *[target for target in DEFAULT_JOB_TARGETS if not is_hn_target(target)]])

    if focus == "india":
        india_markers = (
            "india",
            "indian",
            "bangalore",
            "bengaluru",
            "mumbai",
            "delhi",
            "gurgaon",
            "gurugram",
            "hyderabad",
            "pune",
            "chennai",
            "noida",
            "cutshort",
            "instahyre",
            "naukri",
            "foundit",
            "internshala",
            "glassdoor.co.in",
        )
        filtered = [target for target in filtered if any(marker in target.lower() for marker in india_markers)]
    elif focus == "france":
        france_markers = (
            "france",
            "francetravail",
            "france_travail",
            "paris",
            "lyon",
            "marseille",
            "lille",
            "nantes",
            "bordeaux",
            "toulouse",
            "rennes",
            "strasbourg",
            "montpellier",
            "nice",
            "grenoble",
            "rouen",
            "reims",
            "dijon",
            "welcometothejungle",
            "wttj",
            "hellowork",
            "apec",
            "cadremploi",
            "meteojob",
            "lesjeudis",
            "adzuna",
            "jooble",
            "linkedin",
            "indeed",
            "smartrecruiters",
            "teamtailor",
            "greenhouse",
            "lever",
            "ashby",
            "workable",
            "jobspy",
        )
        filtered = [target for target in filtered if any(marker in target.lower() for marker in france_markers)]

    fallback = INDIA_JOB_TARGETS if focus == "india" else FRANCE_JOB_TARGETS if focus == "france" else DEFAULT_JOB_TARGETS
    return dedupe_targets(filtered) or list(fallback)


def desired_position(cfg: dict) -> str:
    for key in ("desired_position", "target_position", "target_role", "onboarding_target_role"):
        value = str(cfg.get(key) or "").strip()
        if value:
            return value
    return ""


def discovery_location(cfg: dict | None, profile: dict | None = None) -> str:
    """The user's job-search location, in priority order:

    explicit setting (any country/city, worldwide) → the profile's own identity
    location (so just ingesting a CV with a city works) → "" (global/remote).
    Generalizes the old binary india/global switch to any region on Earth.
    """
    cfg = cfg or {}
    for key in ("job_location", "job_region", "target_location", "location"):
        value = str(cfg.get(key) or "").strip()
        if value:
            return value
    # Backward-compat: explicit market focus implies its country.
    focus = job_market_focus(cfg.get("job_market_focus"))
    if focus == "india":
        return "India"
    if focus == "france":
        return "France"
    identity = (profile or {}).get("identity") if isinstance(profile, dict) else None
    if isinstance(identity, dict):
        for key in ("city", "location", "region", "country"):
            value = str(identity.get(key) or "").strip()
            if value:
                return value
    return ""


def discovery_radius_km(cfg: dict | None) -> str:
    cfg = cfg or {}
    for key in ("job_search_radius_km", "job_radius_km", "target_radius_km", "radius_km"):
        if key in cfg:
            return _normalize_radius_km(cfg.get(key), default="")
    return "25"


def remote_preference(cfg: dict | None) -> str:
    """One of: remote, hybrid, onsite, any (default any)."""
    value = str((cfg or {}).get("remote_preference") or "").strip().lower()
    return value if value in {"remote", "hybrid", "onsite", "any"} else "any"


def profile_for_discovery(profile: dict | None, cfg: dict) -> dict:
    profile = dict(profile or {})
    desired = desired_position(cfg)
    base_location = discovery_location(cfg, profile)
    intent = parse_search_intent([desired], base_location) if job_market_focus(cfg.get("job_market_focus")) == "france" and desired else None
    desired_for_profile = intent.role if intent else desired
    if desired:
        summary = str(profile.get("s") or "").strip()
        if desired_for_profile.lower() not in summary.lower():
            profile["s"] = f"{desired_for_profile}. {summary}".strip()
        else:
            profile["s"] = summary or desired_for_profile
        profile["desired_position"] = desired_for_profile
        profile["_discovery_search_text"] = desired
    # Carry resolved location + remote preference so the query planner can target
    # the user's region without every caller threading extra args.
    profile["_discovery_location"] = intent.location if intent else base_location
    profile["_discovery_radius_km"] = discovery_radius_km(cfg)
    profile["_remote_preference"] = "remote" if intent and intent.remote else remote_preference(cfg)
    if intent and intent.contract:
        profile["_discovery_contract"] = intent.contract
    # The user's free-text "what I'm looking for" preferences steer the scan
    # toward roles they actually want (used by the query planner + evaluator).
    profile["_job_preferences"] = str((cfg or {}).get("job_preferences") or "").strip()
    profile["_job_market_focus"] = job_market_focus((cfg or {}).get("job_market_focus"))
    return profile


def terms_for_discovery(profile: dict, limit: int = 4) -> list[str]:
    terms: list[str] = []
    summary = str(profile.get("desired_position") or profile.get("s") or "").strip()
    if summary:
        terms.append(" ".join(summary.split()[:5]))
    for exp in profile.get("exp", []) or []:
        if isinstance(exp, dict) and exp.get("role"):
            terms.append(str(exp["role"]))
    for skill in profile.get("skills", []) or []:
        if isinstance(skill, dict) and skill.get("n"):
            terms.append(str(skill["n"]))
    for project in profile.get("projects", []) or []:
        if not isinstance(project, dict):
            continue
        if project.get("title"):
            terms.append(str(project["title"]))
        stack = project.get("stack") or []
        stack_items = stack if isinstance(stack, list) else str(stack).split(",")
        terms.extend(str(item) for item in stack_items[:3] if str(item).strip())
    for cert in profile.get("certifications", []) or []:
        if isinstance(cert, dict):
            value = cert.get("title") or cert.get("name") or cert.get("n")
            if value:
                terms.append(str(value))
        elif str(cert or "").strip():
            terms.append(str(cert))
    seen: set[str] = set()
    out: list[str] = []
    for term in terms:
        term = re.sub(r"\s+", " ", str(term)).strip(" ,.;:-")
        key = term.lower()
        if term and key not in seen:
            seen.add(key)
            out.append(term)
    return out[:limit] or ["jobs"]


def has_profile_discovery_signal(profile: dict | None) -> bool:
    profile = profile or {}
    if str(profile.get("desired_position") or profile.get("s") or "").strip():
        return True
    for exp in profile.get("exp", []) or []:
        if isinstance(exp, dict) and str(exp.get("role") or "").strip():
            return True
    for skill in profile.get("skills", []) or []:
        if isinstance(skill, dict) and str(skill.get("n") or "").strip():
            return True
    for project in profile.get("projects", []) or []:
        if not isinstance(project, dict):
            continue
        stack = project.get("stack") or []
        stack_items = stack if isinstance(stack, list) else str(stack).split(",")
        if any(str(project.get(key) or "").strip() for key in ("title", "impact", "description", "d")):
            return True
        if any(str(item or "").strip() for item in stack_items):
            return True
    for cert in profile.get("certifications", []) or []:
        if isinstance(cert, dict):
            if any(str(cert.get(key) or "").strip() for key in ("title", "name", "n")):
                return True
        elif str(cert or "").strip():
            return True
    return False


def has_explicit_discovery_targets(cfg: dict | None) -> bool:
    cfg = cfg or {}
    target_keys = (
        "job_boards",
        "free_source_targets",
        "company_watchlist",
        "x_search_queries",
        "x_watchlist",
    )
    if any(str(cfg.get(key) or "").strip() for key in target_keys):
        return True
    return truthy(cfg.get("custom_connectors_enabled", "false")) and bool(
        str(cfg.get("custom_connectors") or "").strip()
    )


def profile_free_source_targets(profile: dict) -> str:
    if not has_profile_discovery_signal(profile):
        return ""
    terms = terms_for_discovery(profile, 3)
    role_query = " ".join(terms[:2])
    targets = [
        f"github:{role_query} hiring help wanted",
        f"hn:{role_query} remote hiring",
    ]
    if job_market_focus(profile.get("_job_market_focus")) != "france":
        targets.append(f"reddit:forhire:{role_query} hiring job remote")
    return "\n".join(targets)


def profile_x_queries(profile: dict, market_focus: str = "global") -> str:
    terms = terms_for_discovery(profile, 4)
    role = " OR ".join(f'"{term}"' for term in terms[:3])
    loc_text = str((profile or {}).get("_discovery_location") or "").strip()
    focus = job_market_focus(market_focus)
    if focus == "india":
        location = '("India" OR "Indian" OR "Bengaluru" OR "Mumbai" OR "Pune" OR "Hyderabad")'
    elif focus == "france":
        location = '("France" OR "Paris" OR "Lyon" OR "remote" OR "hybrid" OR "télétravail")'
    elif loc_text:
        # Any region: include the user's location plus remote alternatives.
        location = f'("{loc_text}" OR "remote" OR "hybrid")'
    else:
        location = '("remote" OR "hybrid" OR "global" OR "onsite")'
    return "\n".join([
        f'("hiring" OR "job opening" OR "open role") ({role}) {location} lang:en -is:retweet',
        f'("we are hiring" OR "is hiring" OR "apply") ({role}) lang:en -is:retweet',
    ])


def has_x_token(cfg: dict) -> bool:
    return bool(cfg.get("x_bearer_token") or os.environ.get("X_BEARER_TOKEN") or os.environ.get("TWITTER_BEARER_TOKEN"))


def int_cfg(cfg: dict, key: str, default: int, min_value: int, max_value: int) -> int:
    raw = str(cfg.get(key, "") or "").strip()
    if not raw:
        # An unset/blank setting is normal — use the default silently. (Logging a
        # "suppressed exception" here spammed the activity stream on every scan.)
        value = default
    else:
        try:
            value = int(raw)
        except (ValueError, TypeError):
            logging.getLogger(__name__).debug('int_cfg: non-numeric %r for %r; using default', raw, key)
            value = default
    return max(min_value, min(value, max_value))


def truthy(value) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "on"}


def free_sources_enabled(cfg: dict) -> bool:
    # Default ON: the keyless ATS/community APIs (Greenhouse/Lever/Ashby/Workable,
    # GitHub issues, HN, Reddit) are the zero-config backbone of discovery and must
    # run for a brand-new user in any country/field with no API key. An unset OR
    # blank value (e.g. a settings row written empty by the UI) means "not
    # configured" and stays ON; only an explicit falsey value opts out.
    raw = str(cfg.get("free_sources_enabled", "") or "").strip()
    if not raw:
        return True
    return truthy(raw)
