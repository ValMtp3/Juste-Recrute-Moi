from __future__ import annotations

from dataclasses import dataclass
import re
import unicodedata
from urllib.parse import parse_qsl


REMOTE_TERMS = (
    "remote",
    "remotely",
    "hybrid",
    "hybride",
    "teletravail",
    "teletravail partiel",
    "télétravail",
    "work from home",
    "wfh",
)

TARGET_LOCATION_KEYS = (
    "lieu",
    "location",
    "where",
    "l",
    "aroundquery",
    "around_query",
    "city",
    "region",
    "country",
)

TARGET_REMOTE_KEYS = ("remote", "teletravail", "télétravail")
COUNTRYWIDE_FRANCE = {"france", "fr"}
UNTARGETED_LOCATIONS = {"", "global", "worldwide", "any", "remote"}

_FALLBACK_FRANCE_LOCATIONS = {
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

_FRENCH_REGION_TERMS = {
    "ile de france",
    "idf",
    "hauts de seine",
    "seine saint denis",
    "val de marne",
    "occitanie",
    "auvergne rhone alpes",
    "provence alpes cote d azur",
    "paca",
    "nouvelle aquitaine",
    "bretagne",
    "grand est",
    "hauts de france",
    "pays de la loire",
    "normandie",
    "bourgogne franche comte",
    "centre val de loire",
}

_TARGET_ALIASES = {
    "paris": ("paris", "ile de france", "idf", "la defense", "75", "92", "93", "94"),
    "lyon": ("lyon", "villeurbanne", "69"),
    "marseille": ("marseille", "13"),
    "lille": ("lille", "59"),
    "nantes": ("nantes", "44"),
    "bordeaux": ("bordeaux", "33"),
    "toulouse": ("toulouse", "31"),
    "rennes": ("rennes", "35"),
    "strasbourg": ("strasbourg", "67"),
    "montpellier": ("montpellier", "34"),
    "nice": ("nice", "06"),
    "grenoble": ("grenoble", "38"),
}

_FOREIGN_LOCATION_TERMS = {
    "austria",
    "belgium",
    "berlin",
    "brussels",
    "canada",
    "dublin",
    "germany",
    "india",
    "ireland",
    "italy",
    "london",
    "madrid",
    "milan",
    "netherlands",
    "poland",
    "portugal",
    "spain",
    "switzerland",
    "united kingdom",
    "united states",
    "usa",
    "warsaw",
}


@dataclass(frozen=True)
class LocationMatch:
    accepted: bool
    reason: str = ""
    target_location: str = ""
    detected_location: str = ""


def normalize_location_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9+#.]+", " ", without_accents.lower()).strip()


def contains_location_term(text: str, term: str) -> bool:
    normalized = normalize_location_text(term)
    if not normalized:
        return False
    if " " in normalized:
        return normalized in text
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(normalized)}(?![a-z0-9])", text))


def _target_params(raw: str) -> dict[str, str]:
    queryish = str(raw or "").replace(";", "&").replace("|", "&")
    params = {
        key.strip().lower(): value.strip()
        for key, value in parse_qsl(queryish, keep_blank_values=False)
        if key.strip() and value.strip()
    }
    for part in re.split(r"[;|]", str(raw or "")):
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip().lower()
        value = value.strip()
        if key and value:
            params[key] = value
    return params


def _target_body(target: str) -> str:
    value = str(target or "").strip()
    lower = value.lower()
    if lower.startswith("ats:"):
        parts = value.split(":", 2)
        return parts[2] if len(parts) == 3 else ""
    if ":" in value:
        return value.split(":", 1)[1]
    return value


def _france_locations() -> set[str]:
    try:
        from core.config import FRANCE_LOCATION_HINTS
    except Exception:
        return set(_FALLBACK_FRANCE_LOCATIONS)
    return {normalize_location_text(item) for item in FRANCE_LOCATION_HINTS} | set(_FALLBACK_FRANCE_LOCATIONS)


def _looks_like_france_location(text: str) -> bool:
    locations = _france_locations() | _FRENCH_REGION_TERMS
    return any(contains_location_term(text, term) for term in locations)


def _location_from_plain_target(raw: str) -> str:
    text = normalize_location_text(raw)
    candidates = sorted(_france_locations() | set(_TARGET_ALIASES), key=len, reverse=True)
    for candidate in candidates:
        if contains_location_term(text, candidate):
            return " ".join(part.capitalize() for part in candidate.split())
    return ""


def target_location_from_target(target: str) -> str:
    raw = _target_body(target)
    params = _target_params(raw)
    for key in TARGET_LOCATION_KEYS:
        value = params.get(key)
        if value:
            return value.strip()

    parts = [part.strip() for part in raw.replace("|", ";").split(";") if part.strip()]
    if len(parts) > 1:
        return ""
    return _location_from_plain_target(raw)


def target_remote_allowed(target: str) -> bool:
    raw = _target_body(target)
    params = _target_params(raw)
    for key in TARGET_REMOTE_KEYS:
        value = str(params.get(key) or "").strip().lower()
        if value in {"1", "true", "yes", "on", "oui"}:
            return True
    text = normalize_location_text(raw)
    return any(contains_location_term(text, term) for term in REMOTE_TERMS)


def remote_allowed_for_target(target: str, remote_preference: str = "") -> bool:
    return target_remote_allowed(target) or str(remote_preference or "").strip().lower() == "remote"


def _meta_location_text(meta: dict) -> str:
    values: list[str] = []
    for key in ("location", "locations", "city", "region", "country", "workplace", "address", "lieu"):
        value = meta.get(key)
        if isinstance(value, (str, int, float)):
            values.append(str(value))
        elif isinstance(value, list):
            values.extend(str(item) for item in value if isinstance(item, (str, int, float)))
    return "\n".join(values)


def _is_google_search_summary(lead: dict) -> bool:
    meta = lead.get("source_meta") if isinstance(lead.get("source_meta"), dict) else {}
    return str(lead.get("platform") or "").lower() == "google_search" or str(meta.get("source") or "").lower() == "google_search"


def _lead_location_text(lead: dict) -> tuple[str, str]:
    meta = lead.get("source_meta") if isinstance(lead.get("source_meta"), dict) else {}
    explicit = "\n".join(
        part
        for part in [
            str(lead.get("location") or ""),
            _meta_location_text(meta),
        ]
        if part.strip()
    )
    if explicit.strip():
        return explicit, explicit
    if _is_google_search_summary(lead):
        return "", ""
    fallback = "\n".join(
        str(lead.get(key) or "")
        for key in ("title", "description")
        if str(lead.get(key) or "").strip()
    )
    return "", fallback


def _has_remote_signal(lead: dict, text: str) -> bool:
    meta = lead.get("source_meta") if isinstance(lead.get("source_meta"), dict) else {}
    if lead.get("remote") is True or meta.get("remote") is True:
        return True
    return any(contains_location_term(text, term) for term in REMOTE_TERMS)


def _has_foreign_location(text: str) -> bool:
    return any(contains_location_term(text, term) for term in _FOREIGN_LOCATION_TERMS)


def _target_aliases(target: str) -> tuple[str, ...]:
    normalized = normalize_location_text(target)
    return _TARGET_ALIASES.get(normalized, (normalized,))


def lead_location_match(
    lead: dict,
    target_location: str,
    *,
    remote_allowed: bool = False,
) -> LocationMatch:
    target = str(target_location or "").strip()
    normalized_target = normalize_location_text(target)
    if normalized_target in UNTARGETED_LOCATIONS:
        return LocationMatch(True, target_location=target)

    explicit, fallback = _lead_location_text(lead)
    haystack = normalize_location_text("\n".join(part for part in (explicit, fallback) if part.strip()))
    detected = explicit.strip() or fallback.strip()
    if not haystack:
        if normalized_target in COUNTRYWIDE_FRANCE:
            return LocationMatch(True, target_location=target)
        return LocationMatch(False, f"localisation inconnue (cible {target})", target, "")

    if normalized_target in COUNTRYWIDE_FRANCE:
        if _has_foreign_location(haystack) and not _looks_like_france_location(haystack):
            return LocationMatch(False, f"localisation hors cible ({target})", target, detected)
        return LocationMatch(True, target_location=target, detected_location=detected)

    if any(contains_location_term(haystack, alias) for alias in _target_aliases(target)):
        return LocationMatch(True, target_location=target, detected_location=detected)

    if remote_allowed and _has_remote_signal(lead, haystack) and not _has_foreign_location(haystack):
        return LocationMatch(True, target_location=target, detected_location=detected)

    return LocationMatch(False, f"localisation hors cible ({target})", target, detected)
