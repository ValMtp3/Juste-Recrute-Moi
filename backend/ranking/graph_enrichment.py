"""Graph-enriched profile for semantic matching.

Traverses the Kuzu graph to produce a richer profile than the flat snapshot
alone. Three enrichments:

1. **Skill expansion** — follows ``PROJ_UTILIZES`` and ``EXP_UTILIZES`` edges
   to discover related skills the candidate hasn't explicitly listed, and
   follows ``RELATED_SKILL`` edges for co-occurrence expansion.

2. **Evidence weighting** — skills backed by project or experience edges are
   annotated with an ``evidence_score`` (0–1) so the scoring engine can trust
   them more than standalone claims.

3. **Domain inference** — traverses experience → company → role patterns to
   infer industry domains (e.g. "fintech", "healthcare SaaS") that can be
   embedded alongside the profile for better JD matching.

All functions fail soft and return empty/default results when the graph is
unavailable, so the matching pipeline never breaks.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict

from core.logging import get_logger

_log = get_logger(__name__)


def _safe_query(query: str, params: dict | None = None) -> list[list]:
    """Execute a graph query, returning rows or [] on any failure."""
    try:
        from data.graph.connection import execute_query
        result = execute_query(query, params)
        rows: list[list] = []
        while result is not None and result.has_next():
            rows.append(result.get_next())
        return rows
    except Exception as exc:
        _log.debug("graph enrichment query skipped: %s", exc)
        return []


# ── 1. Skill expansion ──────────────────────────────────────────────────

def _direct_skills() -> dict[str, dict]:
    """Return {skill_id: {n, cat}} for all Candidate→Skill edges."""
    skills: dict[str, dict] = {}
    for row in _safe_query("MATCH (c:Candidate)-[:HAS_SKILL]->(s:Skill) RETURN s.id, s.n, s.cat"):
        sid, name, cat = str(row[0] or ""), str(row[1] or ""), str(row[2] or "general")
        if sid and name:
            skills[sid] = {"n": name, "cat": cat}
    return skills


def _project_skills() -> dict[str, set[str]]:
    """Return {skill_id: {project_titles...}} for PROJ_UTILIZES edges."""
    mapping: dict[str, set[str]] = defaultdict(set)
    for row in _safe_query(
        "MATCH (p:Project)-[:PROJ_UTILIZES]->(s:Skill) RETURN s.id, s.n, p.title"
    ):
        sid = str(row[0] or "")
        ptitle = str(row[2] or "")
        if sid:
            mapping[sid].add(ptitle)
    return dict(mapping)


def _experience_skills() -> dict[str, set[str]]:
    """Return {skill_id: {experience_labels...}} for EXP_UTILIZES edges."""
    mapping: dict[str, set[str]] = defaultdict(set)
    for row in _safe_query(
        "MATCH (e:Experience)-[:EXP_UTILIZES]->(s:Skill) RETURN s.id, s.n, e.role, e.co"
    ):
        sid = str(row[0] or "")
        label = " at ".join(p for p in [str(row[2] or ""), str(row[3] or "")] if p)
        if sid:
            mapping[sid].add(label)
    return dict(mapping)


def _related_skills() -> dict[str, list[str]]:
    """Return {skill_id: [related_skill_names...]} via RELATED_SKILL edges."""
    mapping: dict[str, list[str]] = defaultdict(list)
    for row in _safe_query(
        "MATCH (a:Skill)-[:RELATED_SKILL]->(b:Skill) RETURN a.id, b.n"
    ):
        sid = str(row[0] or "")
        related = str(row[1] or "")
        if sid and related:
            mapping[sid].append(related)
    return dict(mapping)


def expanded_skills() -> list[dict]:
    """Return all skills with evidence annotations and related expansions.

    Each skill dict has:
      - n, cat, id (standard fields)
      - evidence_score: float 0–1 (how well-evidenced this skill is)
      - evidence_sources: list of strings ("project: X", "experience: Y")
      - related_skills: list of related skill names from graph edges
    """
    direct = _direct_skills()
    proj_skills = _project_skills()
    exp_skills = _experience_skills()
    related = _related_skills()

    results: list[dict] = []
    for sid, info in direct.items():
        sources: list[str] = []
        for ptitle in proj_skills.get(sid, set()):
            sources.append(f"project: {ptitle}")
        for elabel in exp_skills.get(sid, set()):
            sources.append(f"experience: {elabel}")

        # Evidence score: 0.3 base (candidate claims it), +0.35 per evidence type (project/experience)
        evidence = 0.3
        if proj_skills.get(sid):
            evidence += 0.35
        if exp_skills.get(sid):
            evidence += 0.35
        evidence = min(evidence, 1.0)

        results.append({
            "id": sid,
            "n": info["n"],
            "cat": info["cat"],
            "evidence_score": round(evidence, 2),
            "evidence_sources": sources,
            "related_skills": related.get(sid, []),
        })

    return results


# ── 2. Domain inference ──────────────────────────────────────────────────

_DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "fintech": ["fintech", "banking", "payments", "financial", "trading", "investment", "insurance", "lending"],
    "healthcare": ["health", "medical", "clinical", "pharma", "biotech", "hospital", "patient", "telemedicine"],
    "e-commerce": ["ecommerce", "e-commerce", "retail", "marketplace", "shopping", "commerce", "storefront"],
    "edtech": ["education", "edtech", "learning", "lms", "course", "university", "school", "academic"],
    "saas": ["saas", "b2b", "enterprise", "platform", "subscription", "cloud service"],
    "ai/ml": ["ai", "machine learning", "deep learning", "nlp", "computer vision", "data science", "ml"],
    "devtools": ["developer", "devtools", "sdk", "api", "infrastructure", "ci/cd", "devops", "tooling"],
    "cybersecurity": ["security", "cybersecurity", "infosec", "encryption", "vulnerability", "compliance"],
    "gaming": ["gaming", "game", "esports", "unity", "unreal", "gamedev"],
    "social": ["social", "community", "messaging", "chat", "communication", "collaboration"],
    "media": ["media", "streaming", "video", "audio", "podcast", "content", "publishing"],
    "logistics": ["logistics", "supply chain", "shipping", "fleet", "transportation", "delivery"],
}


def infer_domains() -> list[dict]:
    """Infer industry domains from experience roles, companies, and descriptions.

    Returns a list of {domain, confidence, evidence} dicts, sorted by confidence.
    """
    experiences = _safe_query(
        "MATCH (c:Candidate)-[:WORKED_AS]->(e:Experience) RETURN e.role, e.co, e.d"
    )

    domain_evidence: dict[str, list[str]] = defaultdict(list)
    for row in experiences:
        role = str(row[0] or "").lower()
        company = str(row[1] or "").lower()
        desc = str(row[2] or "").lower()
        combined = f"{role} {company} {desc}"

        for domain, keywords in _DOMAIN_KEYWORDS.items():
            for kw in keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", combined):
                    label = " at ".join(p for p in [str(row[0] or ""), str(row[1] or "")] if p)
                    domain_evidence[domain].append(f"{label}: matched '{kw}'")
                    break  # One match per domain per experience is enough

    # Also check project descriptions
    projects = _safe_query(
        "MATCH (c:Candidate)-[:BUILT]->(p:Project) RETURN p.title, p.impact"
    )
    for row in projects:
        title = str(row[0] or "").lower()
        impact = str(row[1] or "").lower()
        combined = f"{title} {impact}"

        for domain, keywords in _DOMAIN_KEYWORDS.items():
            for kw in keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", combined):
                    domain_evidence[domain].append(f"project {row[0]}: matched '{kw}'")
                    break

    results: list[dict] = []
    total_items = len(experiences) + len(projects)
    for domain, evidence in domain_evidence.items():
        # Confidence based on how many items mention this domain
        confidence = min(len(evidence) / max(total_items, 1) * 2.0, 1.0)
        results.append({
            "domain": domain,
            "confidence": round(confidence, 2),
            "evidence_count": len(evidence),
            "evidence": evidence[:5],  # Cap for readability
        })

    return sorted(results, key=lambda d: d["confidence"], reverse=True)


# ── 3. Graph-enriched profile ────────────────────────────────────────────

def graph_enriched_profile(candidate_data: dict | None = None) -> dict:
    """Produce a graph-enriched version of the candidate profile.

    This is the main entry point used by the semantic matching pipeline.
    It takes the flat profile and augments it with:
      - Skills annotated with evidence scores
      - Expanded skill list (related skills from graph edges)
      - Inferred domain tags
      - Richer text representations for embedding

    Falls back to the input ``candidate_data`` unchanged if the graph
    is unavailable.
    """
    if candidate_data is None:
        candidate_data = {}

    try:
        enriched_skills = expanded_skills()
        domains = infer_domains()
    except Exception as exc:
        _log.info("graph enrichment skipped: %s", exc)
        return {**candidate_data, "_graph_enriched": False}

    if not enriched_skills and not domains:
        return {**candidate_data, "_graph_enriched": False}

    # Build enriched skill list: merge graph-enriched skills with flat profile skills
    skill_by_name: dict[str, dict] = {}
    for skill in enriched_skills:
        key = str(skill.get("n") or "").strip().lower()
        if key:
            skill_by_name[key] = skill

    # Preserve any flat-profile skills not in the graph
    for skill in candidate_data.get("skills", []) or []:
        if isinstance(skill, dict):
            name = str(skill.get("n") or skill.get("name") or "").strip()
            key = name.lower()
            if key and key not in skill_by_name:
                skill_by_name[key] = {
                    **skill,
                    "evidence_score": 0.1,  # Listed but no graph evidence
                    "evidence_sources": [],
                    "related_skills": [],
                }

    # Collect related skills that aren't already in the main list
    expansion_skills: list[dict] = []
    seen = set(skill_by_name.keys())
    for skill in enriched_skills:
        for related_name in skill.get("related_skills", []):
            rkey = related_name.strip().lower()
            if rkey and rkey not in seen:
                seen.add(rkey)
                expansion_skills.append({
                    "n": related_name,
                    "cat": "graph_related",
                    "evidence_score": 0.15,
                    "evidence_sources": [f"related to: {skill['n']}"],
                    "related_skills": [],
                })

    # Build domain text for embedding enrichment
    domain_texts: list[str] = []
    for d in domains[:5]:
        if d["confidence"] >= 0.2:
            domain_texts.append(f"Domain experience: {d['domain']} (confidence: {d['confidence']})")

    return {
        **candidate_data,
        "skills": list(skill_by_name.values()) + expansion_skills,
        "_enriched_skills": list(skill_by_name.values()),
        "_expansion_skills": expansion_skills,
        "_domains": domains[:5],
        "_domain_text": "\n".join(domain_texts),
        "_graph_enriched": True,
    }


def enriched_profile_text(enriched: dict) -> str:
    """Convert an enriched profile into a single text block for embedding.

    Produces richer text than the flat profile by including evidence annotations
    and domain context.
    """
    parts: list[str] = []

    name = str(enriched.get("n") or "").strip()
    summary = str(enriched.get("s") or "").strip()
    if name or summary:
        parts.append(f"Candidate: {name}\n{summary}")

    # Skills with evidence weighting
    high_evidence: list[str] = []
    medium_evidence: list[str] = []
    low_evidence: list[str] = []
    for skill in enriched.get("_enriched_skills", enriched.get("skills", [])) or []:
        if not isinstance(skill, dict):
            continue
        name = str(skill.get("n") or "").strip()
        if not name:
            continue
        score = skill.get("evidence_score", 0.3)
        if score >= 0.65:
            sources = skill.get("evidence_sources", [])
            high_evidence.append(f"{name} (proven in: {', '.join(sources[:2])})")
        elif score >= 0.3:
            medium_evidence.append(name)
        else:
            low_evidence.append(name)

    if high_evidence:
        parts.append("Strongly evidenced skills: " + ", ".join(high_evidence))
    if medium_evidence:
        parts.append("Core skills: " + ", ".join(medium_evidence))
    if low_evidence:
        parts.append("Additional skills: " + ", ".join(low_evidence))

    # Expansion skills
    expansion = enriched.get("_expansion_skills", [])
    if expansion:
        names = [str(s.get("n") or "") for s in expansion if s.get("n")]
        if names:
            parts.append("Related/adjacent skills: " + ", ".join(names))

    # Domain context
    domain_text = enriched.get("_domain_text", "")
    if domain_text:
        parts.append(domain_text)

    # Projects (standard)
    for proj in enriched.get("projects", []) or []:
        if not isinstance(proj, dict):
            continue
        title = str(proj.get("title") or "").strip()
        stack = proj.get("stack", [])
        if isinstance(stack, list):
            stack = ", ".join(str(s) for s in stack)
        impact = str(proj.get("impact") or "").strip()
        if title:
            parts.append(f"Project: {title} | Stack: {stack} | Impact: {impact}")

    # Experience (standard)
    for exp in enriched.get("exp", []) or []:
        if not isinstance(exp, dict):
            continue
        role = str(exp.get("role") or "").strip()
        co = str(exp.get("co") or "").strip()
        period = str(exp.get("period") or "").strip()
        desc = str(exp.get("d") or "").strip()
        if role or co:
            parts.append(f"Experience: {role} at {co} ({period}) — {desc}")

    return "\n".join(parts)
