"""Profile read + snapshot management for the graph layer.

Reads the profile from the persisted snapshot, the Kùzu graph, and the LanceDB
vectors, and merges those sources into one normalized profile. Owns the
snapshot load/save and the refresh that rebuilds the snapshot from graph +
vectors. Sits above base/deletions/vectors; does not import correlations or
mutations.
"""

from __future__ import annotations

import json
import logging

from core.logging import get_logger
from data.graph.profile_base import (
    IDENTITY_KEYS,
    PROFILE_SNAPSHOT_KEY,
    _query_rows,
    empty_profile,
    normal_profile,
    profile_has_data,
    profile_has_structured_data,
    stack_list,
)
from data.graph.profile_deletions import apply_profile_deletions
from data.graph.profile_vectors import read_profile_from_vectors
from data.sqlite.settings import get_setting, save_settings

_log = get_logger(__name__)


def load_profile_snapshot(db_path: str | None = None) -> dict:
    try:
        raw = get_setting(PROFILE_SNAPSHOT_KEY, "", db_path) if db_path else get_setting(PROFILE_SNAPSHOT_KEY)
        if not raw:
            return {}
        profile = apply_profile_deletions(json.loads(raw or "{}"), db_path)
        return profile if profile_has_data(profile) else {}
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:load_profile_snapshot: %s', log_exc)
        return {}


def save_profile_snapshot(profile: dict, db_path: str | None = None, *, allow_empty: bool = False) -> None:
    profile = apply_profile_deletions(profile, db_path)
    if not allow_empty and not profile_has_data(profile):
        return
    try:
        payload = {PROFILE_SNAPSHOT_KEY: json.dumps(profile, ensure_ascii=False)}
        if db_path:
            save_settings(payload, db_path)
        else:
            save_settings(payload)
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:save_profile_snapshot: %s', log_exc)
        pass


def read_profile_from_graph(*, require_graph: bool = False) -> dict:
    candidates = _query_rows("MATCH (n:Candidate) RETURN n.id, n.n, n.s", require_result=require_graph)
    if candidates:
        candidates.sort(
            key=lambda row: (
                0 if str(row[1] or "").strip().lower() in {"", "unknown", "candidate"} else 1,
                len(str(row[1] or "")) + len(str(row[2] or "")),
            ),
            reverse=True,
        )
        candidate = candidates[0]
    else:
        candidate = ["", "", ""]

    skills = []
    for row in _query_rows("MATCH (n:Skill) RETURN n.id, n.n, n.cat", require_result=require_graph):
        skills.append({"id": row[0], "n": row[1], "cat": row[2]})

    projects = []
    for row in _query_rows("MATCH (n:Project) RETURN n.id, n.title, n.stack, n.repo, n.impact", require_result=require_graph):
        projects.append({"id": row[0], "title": row[1], "stack": stack_list(row[2]), "repo": row[3], "impact": row[4]})

    experience = []
    for row in _query_rows("MATCH (n:Experience) RETURN n.id, n.role, n.co, n.period, n.d", require_result=require_graph):
        experience.append({"id": row[0], "role": row[1], "co": row[2], "period": row[3], "d": row[4]})

    def read_text_nodes(label: str) -> list[str]:
        items: list[str] = []
        for row in _query_rows(f"MATCH (n:{label}) RETURN n.title", require_result=require_graph):
            text = str(row[0] or "").strip()
            if text:
                items.append(text)
        return items

    return apply_profile_deletions({
        "n": candidate[1],
        "s": candidate[2],
        "skills": skills,
        "projects": projects,
        "exp": experience,
        "certifications": read_text_nodes("Certification"),
        "education": read_text_nodes("Education"),
        "achievements": read_text_nodes("Achievement"),
        "identity": {key: get_setting(key, "") for key in IDENTITY_KEYS},
    })


def get_profile(db_path: str | None = None, *, prefer_snapshot: bool = True) -> dict:
    snapshot = load_profile_snapshot(db_path)
    if prefer_snapshot and profile_has_structured_data(snapshot):
        return snapshot
    merged = normal_profile(snapshot)
    hydrated = False
    source_has_data = False
    read_error: Exception | None = None
    try:
        graph_profile = normal_profile(read_profile_from_graph(require_graph=True))
        if profile_has_data(graph_profile):
            source_has_data = True
            merged = merge_profiles(merged, graph_profile)
            hydrated = hydrated or profile_has_structured_data(graph_profile)
    except Exception as exc:
        _log.warning("profile graph read skipped: %s", exc)
        read_error = exc

    vector_profile = read_profile_from_vectors(db_path)
    if profile_has_data(vector_profile):
        source_has_data = True
        merged = merge_profiles(merged, vector_profile)
        hydrated = hydrated or profile_has_structured_data(vector_profile)

    if snapshot and not source_has_data:
        return snapshot
    if profile_has_data(merged):
        if hydrated and profile_has_structured_data(merged):
            save_profile_snapshot(merged, db_path)
        return merged
    if snapshot:
        return snapshot
    if read_error:
        _log.error("profile read failed: %s", read_error)
    return empty_profile()


def merge_profiles(base: dict | None, incoming: dict | None) -> dict:
    merged = normal_profile(base)
    incoming = normal_profile(incoming)
    if str(incoming.get("n") or "").strip().lower() not in {"", "unknown", "candidate"}:
        merged["n"] = incoming.get("n", "")
    if str(incoming.get("s") or "").strip():
        merged["s"] = incoming.get("s", "")
    merged["identity"] = {**(merged.get("identity") or {}), **{k: v for k, v in (incoming.get("identity") or {}).items() if v}}
    for key, id_key in [("skills", "id"), ("projects", "id"), ("exp", "id")]:
        seen: set[str] = set()
        rows: list[dict] = []
        for item in [*(merged.get(key) or []), *(incoming.get(key) or [])]:
            if not isinstance(item, dict):
                continue
            marker = str(item.get(id_key) or item.get("n") or item.get("title") or item.get("role") or "").strip().lower()
            if not marker or marker in seen:
                continue
            seen.add(marker)
            rows.append(item)
        merged[key] = rows
    for key in ["education", "certifications", "achievements"]:
        seen_text: set[str] = set()
        values: list[str] = []
        for item in [*(merged.get(key) or []), *(incoming.get(key) or [])]:
            text = str(item.get("title") if isinstance(item, dict) else item or "").strip()
            marker = text.lower()
            if text and marker not in seen_text:
                seen_text.add(marker)
                values.append(text)
        merged[key] = values
    return merged


def refresh_profile_snapshot(db_path: str | None = None) -> None:
    graph_profile = {}
    vector_profile = {}
    try:
        graph_profile = read_profile_from_graph()
    except Exception as exc:
        _log.warning("profile graph refresh skipped: %s", exc)
    try:
        vector_profile = read_profile_from_vectors(db_path)
    except Exception as exc:
        _log.warning("profile vector refresh skipped: %s", exc)
    profile = merge_profiles(graph_profile, vector_profile)
    if profile_has_data(profile):
        save_profile_snapshot(profile, db_path)
