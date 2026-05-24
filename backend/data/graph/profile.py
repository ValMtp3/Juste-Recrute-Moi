from __future__ import annotations
import logging

import re
from urllib.parse import unquote

from core.logging import get_logger
from data.graph.connection import execute_query, sync_profile_relationships
from data.sqlite.settings import save_settings
from graph_service.helpers import is_bad_vector_label
from data.graph.profile_base import (  # re-exported as profile.py public API
    IDENTITY_KEYS,
    _bulk_import_active,
    _dedupe_ids,
    _entry_key,
    _entry_text,
    _norm_key,
    _query_rows,
    _safe_execute,
    _upsert_node,
    _vec,
    bulk_profile_import,
    clean_profile_summary,
    empty_profile,
    hash_id,
    normal_profile,
    profile_has_data,
    stack_list,
)
from data.graph.profile_deletions import (
    _delete_tokens,
    _forget_profile_deletion,
    _load_profile_deletions,
    _remember_profile_deletion,
)
from data.graph.profile_vectors import (
    add_candidate_vec,
    add_credential_vec,
    add_experience_vec,
    add_profile_vec,
    add_project_vec,
    add_skill_vec,
    credential_text,
    delete_vec_id_from_all,
    delete_vec_rows,
    drop_profile_aggregate_vector,
    experience_text,
    profile_text,
    project_text,
    prune_bad_vector_rows,
    skill_text,
)
from data.graph.profile_read import (
    get_profile,
    load_profile_snapshot,
    merge_profiles,
    read_profile_from_graph,
    refresh_profile_snapshot,
    save_profile_snapshot,
)

# Re-exported for the profile.py public API (used by api / graph_service / tests, not here):
from data.graph.profile_base import PROFILE_DELETE_KEYS as PROFILE_DELETE_KEYS
from data.graph.profile_base import PROFILE_DELETIONS_KEY as PROFILE_DELETIONS_KEY
from data.graph.profile_deletions import filter_embedding_deletions as filter_embedding_deletions
from data.graph.profile_deletions import filter_graph_deletions as filter_graph_deletions
from data.graph.profile_deletions import forget_profile_deletions_for_profile as forget_profile_deletions_for_profile
from data.graph.profile_vectors import _normalize_table_names as _normalize_table_names
from data.graph.profile_vectors import put_vec_rows as put_vec_rows
from data.graph.profile_vectors import vec_table_names as vec_table_names
from data.graph.profile_deletions import apply_profile_deletions as apply_profile_deletions
from data.graph.profile_vectors import read_profile_from_vectors as read_profile_from_vectors

_log = get_logger(__name__)

def _refresh_after_write(db_path: str | None = None) -> None:
    if not _bulk_import_active():
        refresh_profile_snapshot(db_path)


def _save_profile_patch(patch: dict, db_path: str | None = None) -> None:
    if _bulk_import_active():
        return
    try:
        base = load_profile_snapshot(db_path)
        try:
            graph = read_profile_from_graph()
            if profile_has_data(graph):
                base = merge_profiles(base, graph)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_save_profile_patch: %s', log_exc)
            pass
        save_profile_snapshot(merge_profiles(base, patch), db_path)
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_save_profile_patch: %s', log_exc)
        pass


def materialize_profile_snapshot(profile: dict | None = None, db_path: str | None = None) -> dict:
    profile = normal_profile(profile or get_profile(db_path))
    if not profile_has_data(profile):
        return {"status": "skipped", "created": 0, "reason": "no profile data"}

    created = 0
    with bulk_profile_import():
        update_candidate(profile.get("n", ""), profile.get("s", ""), db_path)
        created += 1
        for item in profile.get("skills", []) or []:
            if not isinstance(item, dict):
                name = str(item or "").strip()
                category = "general"
            else:
                name = str(item.get("n") or item.get("name") or item.get("title") or "").strip()
                category = str(item.get("cat") or item.get("category") or "general").strip() or "general"
            if name:
                add_skill(name, category, db_path)
                created += 1
        for item in profile.get("projects", []) or []:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or item.get("name") or "").strip()
            if not title:
                continue
            stack = ", ".join(stack_list(item.get("stack")))
            add_project(title, stack, str(item.get("repo") or item.get("url") or ""), str(item.get("impact") or item.get("description") or item.get("text") or ""), db_path)
            created += 1
        for item in profile.get("exp", []) or []:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or item.get("title") or "").strip()
            company = str(item.get("co") or item.get("company") or item.get("org") or "").strip()
            if not role and not company:
                continue
            add_experience(role, company, str(item.get("period") or item.get("dates") or ""), str(item.get("d") or item.get("description") or item.get("text") or ""), db_path)
            created += 1
        for title in profile.get("education", []) or []:
            text = _entry_text(title)
            if text:
                add_education(text, db_path)
                created += 1
        for title in profile.get("certifications", []) or []:
            text = _entry_text(title)
            if text:
                add_certification(text, db_path)
                created += 1
        for title in profile.get("achievements", []) or []:
            text = _entry_text(title)
            if text:
                add_achievement(text, db_path)
                created += 1

    sync = sync_profile_relationships()
    save_profile_snapshot(profile, db_path)
    return {"status": "ok", "created": created, "relationships": sync}


def purge_profile_deletion_tombstones(db_path: str | None = None) -> dict:
    deletions = _load_profile_deletions(db_path)
    purged = 0

    def deleted(key: str, *values) -> bool:
        tokens = _delete_tokens(values)
        return bool(tokens.intersection(deletions.get(key, [])))

    for row in _query_rows("MATCH (s:Skill) RETURN s.id, s.n"):
        node_id, name = str(row[0] or ""), str(row[1] or "")
        if deleted("skills", node_id, name, hash_id(name)):
            delete_vec_id_from_all(node_id)
            _safe_execute("MATCH (s:Skill) WHERE s.id = $id DETACH DELETE s", {"id": node_id})
            purged += 1

    for row in _query_rows("MATCH (p:Project) RETURN p.id, p.title"):
        node_id, title = str(row[0] or ""), str(row[1] or "")
        if deleted("projects", node_id, title, hash_id(title)):
            delete_vec_id_from_all(node_id)
            _safe_execute("MATCH (p:Project) WHERE p.id = $id DETACH DELETE p", {"id": node_id})
            purged += 1

    for row in _query_rows("MATCH (e:Experience) RETURN e.id, e.role, e.co"):
        node_id = str(row[0] or "")
        role = str(row[1] or "")
        company = str(row[2] or "")
        if deleted("exp", node_id, role, company, role + company, " at ".join(part for part in [role, company] if part), " - ".join(part for part in [role, company] if part)):
            delete_vec_id_from_all(node_id)
            _safe_execute("MATCH (e:Experience) WHERE e.id = $id DETACH DELETE e", {"id": node_id})
            purged += 1

    for label, key in [("Education", "education"), ("Certification", "certifications"), ("Achievement", "achievements")]:
        for row in _query_rows(f"MATCH (n:{label}) RETURN n.id, n.title"):
            node_id, title = str(row[0] or ""), str(row[1] or "")
            if deleted(key, node_id, title, hash_id(title)):
                delete_vec_id_from_all(node_id)
                _safe_execute(f"MATCH (n:{label}) WHERE n.id = $id DETACH DELETE n", {"id": node_id})
                purged += 1

    if purged:
        refresh_profile_snapshot(db_path)
    return {"status": "ok", "purged": purged}


def sync_vectors_from_graph() -> dict:
    store = _vec()
    if getattr(store, "available", True) is False:
        return {
            "status": "disabled",
            "synced": 0,
            "error": getattr(store, "reason", "") or "vector store is unavailable",
        }
    purge_profile_deletion_tombstones()
    deleted_bad_rows = prune_bad_vector_rows()
    candidates = []
    skills = []
    projects = []
    experiences = []
    credentials = []
    try:
        result = execute_query("MATCH (c:Candidate) RETURN c.id, c.n, c.s")
        while result and result.has_next():
            candidates.append(result.get_next())
        result = execute_query("MATCH (s:Skill) RETURN s.id, s.n, s.cat")
        while result and result.has_next():
            skills.append(result.get_next())
        result = execute_query("MATCH (p:Project) RETURN p.id, p.title, p.stack, p.impact")
        while result and result.has_next():
            projects.append(result.get_next())
        result = execute_query("MATCH (e:Experience) RETURN e.id, e.role, e.co, e.period, e.d")
        while result and result.has_next():
            experiences.append(result.get_next())
        for label in ["Certification", "Education", "Achievement"]:
            result = execute_query(f"MATCH (n:{label}) RETURN n.id, n.title")
            while result and result.has_next():
                row = result.get_next()
                credentials.append([row[0], row[1], label])
    except Exception as exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:sync_vectors_from_graph: %s', exc)
        return {"status": "error", "synced": 0, "error": str(exc)}

    synced = 0
    profile_parts: list[str] = []
    for candidate_id, name, summary in candidates:
        if is_bad_vector_label(name) and is_bad_vector_label(summary):
            continue
        add_candidate_vec(str(candidate_id), str(name or ""), str(summary or ""))
        profile_parts.append(profile_text(name, summary))
        synced += 1
    for skill_id, name, category in skills:
        if is_bad_vector_label(name):
            continue
        add_skill_vec(str(skill_id), str(name), str(category or "general"))
        profile_parts.append(skill_text(name, category))
        synced += 1
    for project_id, title, stack, impact in projects:
        if is_bad_vector_label(title):
            continue
        add_project_vec(str(project_id), str(title), str(stack or ""), str(impact or ""))
        profile_parts.append(project_text(title, stack, impact))
        synced += 1
    for experience_id, role, company, period, description in experiences:
        if is_bad_vector_label(role) and is_bad_vector_label(company):
            continue
        add_experience_vec(str(experience_id), str(role or ""), str(company or ""), str(period or ""), str(description or ""))
        profile_parts.append(experience_text(role, company, period, description))
        synced += 1
    for credential_id, title, kind in credentials:
        if is_bad_vector_label(title):
            continue
        add_credential_vec(str(credential_id), str(title), str(kind))
        profile_parts.append(credential_text(title, kind))
        synced += 1
    if profile_parts:
        add_profile_vec("profile:default", "Complete profile", "\n".join(profile_parts))
        synced += 1
    return {"status": "ok", "synced": synced, "deleted_bad_rows": deleted_bad_rows}


def rebuild_profile_correlations(db_path: str | None = None) -> dict:
    """Rebuild derived graph correlations and re-embed the profile.

    Ingest paths create direct edges per item (HAS_SKILL / PROJ_UTILIZES /
    EXP_UTILIZES) but NOT the derived correlation edges (RELATED_SKILL,
    SIMILAR_PROJECT, PROJECT_SUPPORTS_EXPERIENCE, credential->skill). Those are
    only produced by sync_profile_relationships(). Run this after an ingest so
    correlations and vector tables reflect the freshly imported profile in one
    pass, instead of waiting for a manual Knowledge-page repair sync.
    """
    relationships = sync_profile_relationships()
    vectors = sync_vectors_from_graph()
    return {"status": "ok", "relationships": relationships, "vectors": vectors}


def _candidate_id() -> str | None:
    rows = _query_rows("MATCH (c:Candidate) RETURN c.id LIMIT 1")
    return rows[0][0] if rows else None


def _link_to_candidate(label: str, node_id: str, rel: str) -> None:
    candidate_id = _candidate_id()
    if not candidate_id:
        return
    try:
        execute_query(
            f"MATCH (a:Candidate {{id: $s}}), (b:{label} {{id: $d}}) MERGE (a)-[:{rel}]->(b)",
            {"s": candidate_id, "d": node_id},
        )
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_link_to_candidate: %s', log_exc)
        pass


def _unlink_outgoing(label: str, node_id: str, rel: str) -> None:
    try:
        execute_query(f"MATCH (n:{label} {{id: $id}})-[r:{rel}]->() DELETE r", {"id": node_id})
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_unlink_outgoing: %s', log_exc)
        pass


def _skill_rows_by_name() -> dict[str, str]:
    rows: dict[str, str] = {}
    for row in _query_rows("MATCH (s:Skill) RETURN s.id, s.n"):
        name = str(row[1] or "").strip().lower()
        if name:
            rows[name] = str(row[0] or "")
    return rows


def _link_project_skills(project_id: str, stack: str, db_path: str | None = None, replace: bool = False) -> None:
    if replace:
        _unlink_outgoing("Project", project_id, "PROJ_UTILIZES")
    for skill_name in stack_list(stack):
        skill = add_skill(skill_name, "project_stack", db_path)
        try:
            execute_query(
                "MATCH (p:Project {id: $project_id}), (s:Skill {id: $skill_id}) MERGE (p)-[:PROJ_UTILIZES]->(s)",
                {"project_id": project_id, "skill_id": skill["id"]},
            )
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_link_project_skills: %s', log_exc)
            pass


def _link_experience_skills(experience_id: str, text: str, replace: bool = False) -> None:
    if replace:
        _unlink_outgoing("Experience", experience_id, "EXP_UTILIZES")
    lower_text = str(text or "").lower()
    if not lower_text:
        return
    for skill_name, skill_id in _skill_rows_by_name().items():
        if len(skill_name) < 2:
            continue
        pattern = r"(?<![a-z0-9+#.-])" + re.escape(skill_name) + r"(?![a-z0-9+#.-])"
        if re.search(pattern, lower_text):
            try:
                execute_query(
                    "MATCH (e:Experience {id: $experience_id}), (s:Skill {id: $skill_id}) MERGE (e)-[:EXP_UTILIZES]->(s)",
                    {"experience_id": experience_id, "skill_id": skill_id},
                )
            except Exception as log_exc:
                logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_link_experience_skills: %s', log_exc)
                pass


def add_skill(name: str, category: str, db_path: str | None = None) -> dict:
    name = str(name or "").strip()
    category = str(category or "general").strip() or "general"
    skill_id = hash_id(name)
    _forget_profile_deletion("skills", [skill_id, name], db_path)
    _upsert_node("Skill", {"id": skill_id, "n": name, "cat": category})
    if not _bulk_import_active():
        try:
            add_skill_vec(skill_id, name, category)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:add_skill: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _link_to_candidate("Skill", skill_id, "HAS_SKILL")
    _refresh_after_write(db_path)
    _save_profile_patch({"skills": [{"id": skill_id, "n": name, "cat": category}]}, db_path)
    return {"id": skill_id, "n": name, "cat": category}


def update_skill(skill_id: str, name: str, category: str, db_path: str | None = None) -> dict:
    name = str(name or "").strip()
    category = str(category or "general").strip() or "general"
    _forget_profile_deletion("skills", [skill_id, name, hash_id(name)], db_path)
    _safe_execute(
        "MATCH (s:Skill) WHERE s.id = $id SET s.n = $n, s.cat = $cat",
        {"id": skill_id, "n": name, "cat": category},
    )
    if not _bulk_import_active():
        try:
            add_skill_vec(skill_id, name, category)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:update_skill: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _link_to_candidate("Skill", skill_id, "HAS_SKILL")
    _refresh_after_write(db_path)
    snapshot = load_profile_snapshot(db_path)
    skills = []
    for item in snapshot.get("skills", []) or []:
        if isinstance(item, dict) and str(item.get("id") or "") == str(skill_id):
            skills.append({"id": skill_id, "n": name, "cat": category})
        else:
            skills.append(item)
    if not any(isinstance(item, dict) and str(item.get("id") or "") == str(skill_id) for item in skills):
        skills.append({"id": skill_id, "n": name, "cat": category})
    save_profile_snapshot({**normal_profile(snapshot), "skills": skills}, db_path)
    return {"id": skill_id, "n": name, "cat": category}


def delete_skill(skill_id: str, db_path: str | None = None) -> None:
    value = unquote(str(skill_id or "")).strip()
    delete_ids = _skill_delete_ids(value)
    _remember_profile_deletion("skills", [value, *delete_ids], db_path)
    delete_vec_rows("skills", delete_ids)
    for node_id in delete_ids:
        delete_vec_id_from_all(node_id)
        _safe_execute("MATCH (s:Skill) WHERE s.id = $id DETACH DELETE s", {"id": node_id})
    drop_profile_aggregate_vector()
    snapshot = normal_profile(load_profile_snapshot(db_path))
    delete_id_set = set(delete_ids)
    delete_key = _norm_key(value)
    snapshot["skills"] = [
        item
        for item in snapshot.get("skills", [])
        if not (
            isinstance(item, dict)
            and (
                str(item.get("id") or "") in delete_id_set
                or hash_id(str(item.get("n") or "").strip()) in delete_id_set
                or _norm_key(item.get("n")) == delete_key
            )
        )
    ]
    save_profile_snapshot(snapshot, db_path, allow_empty=True)


def add_experience(role: str, company: str, period: str, description: str, db_path: str | None = None) -> dict:
    role = str(role or "").strip()
    company = str(company or "").strip()
    period = str(period or "").strip()
    description = str(description or "").strip()
    experience_id = hash_id(role + company)
    _forget_profile_deletion("exp", [experience_id, role, company, role + company, " at ".join(part for part in [role, company] if part)], db_path)
    _upsert_node("Experience", {"id": experience_id, "role": role, "co": company, "period": period, "d": description})
    _link_to_candidate("Experience", experience_id, "WORKED_AS")
    _link_experience_skills(experience_id, f"{role} {company} {description}")
    if not _bulk_import_active():
        try:
            add_experience_vec(experience_id, role, company, period, description)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:add_experience: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _refresh_after_write(db_path)
    _save_profile_patch({"exp": [{"id": experience_id, "role": role, "co": company, "period": period, "d": description}]}, db_path)
    return {"id": experience_id, "role": role, "co": company, "period": period, "d": description}


def update_experience(experience_id: str, role: str, company: str, period: str, description: str, db_path: str | None = None) -> dict:
    role = str(role or "").strip()
    company = str(company or "").strip()
    period = str(period or "").strip()
    description = str(description or "").strip()
    _forget_profile_deletion("exp", [experience_id, role, company, role + company, " at ".join(part for part in [role, company] if part)], db_path)
    _safe_execute(
        "MATCH (e:Experience) WHERE e.id = $id SET e.role = $role, e.co = $co, e.period = $period, e.d = $d",
        {"id": experience_id, "role": role, "co": company, "period": period, "d": description},
    )
    _link_to_candidate("Experience", experience_id, "WORKED_AS")
    _link_experience_skills(experience_id, f"{role} {company} {description}", replace=True)
    if not _bulk_import_active():
        try:
            add_experience_vec(experience_id, role, company, period, description)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:update_experience: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _refresh_after_write(db_path)
    snapshot = normal_profile(load_profile_snapshot(db_path))
    row = {"id": experience_id, "role": role, "co": company, "period": period, "d": description}
    snapshot["exp"] = [row if isinstance(item, dict) and str(item.get("id") or "") == str(experience_id) else item for item in snapshot.get("exp", [])]
    if not any(isinstance(item, dict) and str(item.get("id") or "") == str(experience_id) for item in snapshot["exp"]):
        snapshot["exp"].append(row)
    save_profile_snapshot(snapshot, db_path)
    return {"id": experience_id, "role": role, "co": company, "period": period, "d": description}


def delete_experience(experience_id: str, db_path: str | None = None) -> None:
    value = unquote(str(experience_id or "")).strip()
    delete_ids = _experience_delete_ids(value)
    _remember_profile_deletion("exp", [value, *delete_ids], db_path)
    delete_vec_rows("experiences", delete_ids)
    for node_id in delete_ids:
        delete_vec_id_from_all(node_id)
        _safe_execute("MATCH (e:Experience) WHERE e.id = $id DETACH DELETE e", {"id": node_id})
    drop_profile_aggregate_vector()
    snapshot = normal_profile(load_profile_snapshot(db_path))
    delete_id_set = set(delete_ids)
    delete_key = _norm_key(value)
    snapshot["exp"] = [
        item
        for item in snapshot.get("exp", [])
        if not (
            isinstance(item, dict)
            and (
                str(item.get("id") or "") in delete_id_set
                or hash_id(str(item.get("role") or "") + str(item.get("co") or "")) in delete_id_set
                or _norm_key(" at ".join(part for part in [item.get("role"), item.get("co")] if part)) == delete_key
            )
        )
    ]
    save_profile_snapshot(snapshot, db_path, allow_empty=True)


def add_project(title: str, stack: str, repo: str, impact: str, db_path: str | None = None) -> dict:
    title = str(title or "").strip()
    stack = str(stack or "").strip()
    repo = str(repo or "").strip()
    impact = str(impact or "").strip()
    project_id = hash_id(title)
    _forget_profile_deletion("projects", [project_id, title], db_path)
    _upsert_node("Project", {"id": project_id, "title": title, "stack": stack, "repo": repo, "impact": impact})
    _link_to_candidate("Project", project_id, "BUILT")
    _link_project_skills(project_id, stack, db_path)
    if not _bulk_import_active():
        try:
            add_project_vec(project_id, title, stack, impact)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:add_project: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _refresh_after_write(db_path)
    _save_profile_patch({"projects": [{"id": project_id, "title": title, "stack": stack_list(stack), "repo": repo, "impact": impact}]}, db_path)
    return {"id": project_id, "title": title, "stack": stack.split(",") if stack else [], "repo": repo, "impact": impact}


def update_project(project_id: str, title: str, stack: str, repo: str, impact: str, db_path: str | None = None) -> dict:
    title = str(title or "").strip()
    stack = str(stack or "").strip()
    repo = str(repo or "").strip()
    impact = str(impact or "").strip()
    _forget_profile_deletion("projects", [project_id, title, hash_id(title)], db_path)
    _safe_execute(
        "MATCH (p:Project) WHERE p.id = $id SET p.title = $title, p.stack = $stack, p.repo = $repo, p.impact = $impact",
        {"id": project_id, "title": title, "stack": stack, "repo": repo, "impact": impact},
    )
    _link_to_candidate("Project", project_id, "BUILT")
    _link_project_skills(project_id, stack, db_path, replace=True)
    if not _bulk_import_active():
        try:
            add_project_vec(project_id, title, stack, impact)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:update_project: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _refresh_after_write(db_path)
    snapshot = normal_profile(load_profile_snapshot(db_path))
    row = {"id": project_id, "title": title, "stack": stack_list(stack), "repo": repo, "impact": impact}
    snapshot["projects"] = [row if isinstance(item, dict) and str(item.get("id") or "") == str(project_id) else item for item in snapshot.get("projects", [])]
    if not any(isinstance(item, dict) and str(item.get("id") or "") == str(project_id) for item in snapshot["projects"]):
        snapshot["projects"].append(row)
    save_profile_snapshot(snapshot, db_path)
    return {"id": project_id, "title": title, "stack": stack.split(",") if stack else [], "repo": repo, "impact": impact}


def delete_project(project_id: str, db_path: str | None = None) -> None:
    value = unquote(str(project_id or "")).strip()
    delete_ids = _project_delete_ids(value)
    _remember_profile_deletion("projects", [value, *delete_ids], db_path)
    delete_vec_rows("projects", delete_ids)
    for node_id in delete_ids:
        delete_vec_id_from_all(node_id)
        _safe_execute("MATCH (p:Project) WHERE p.id = $id DETACH DELETE p", {"id": node_id})
    drop_profile_aggregate_vector()
    snapshot = normal_profile(load_profile_snapshot(db_path))
    delete_id_set = set(delete_ids)
    delete_key = _norm_key(value)
    snapshot["projects"] = [
        item
        for item in snapshot.get("projects", [])
        if not (
            isinstance(item, dict)
            and (
                str(item.get("id") or "") in delete_id_set
                or hash_id(str(item.get("title") or "").strip()) in delete_id_set
                or _norm_key(item.get("title")) == delete_key
            )
        )
    ]
    save_profile_snapshot(snapshot, db_path, allow_empty=True)


def _add_text_node(label: str, rel: str, title: str, db_path: str | None = None) -> dict:
    title = str(title or "").strip()
    node_id = hash_id(title)
    key = {
        "Education": "education",
        "Certification": "certifications",
        "Achievement": "achievements",
    }.get(label)
    if key:
        _forget_profile_deletion(key, [node_id, title], db_path)
    _upsert_node(label, {"id": node_id, "title": title})
    _link_to_candidate(label, node_id, rel)
    if not _bulk_import_active():
        try:
            add_credential_vec(node_id, title, label)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:_add_text_node: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    _refresh_after_write(db_path)
    if key:
        _save_profile_patch({key: [title]}, db_path)
    return {"id": node_id, "title": title}


def _skill_delete_ids(skill_id_or_name: str) -> list[str]:
    value = unquote(str(skill_id_or_name or "")).strip()
    if not value:
        return []
    ids = [value, hash_id(value)]
    wanted_key = _norm_key(value)
    for row in _query_rows("MATCH (s:Skill) RETURN s.id, s.n"):
        node_id = str(row[0] or "").strip()
        name = str(row[1] or "").strip()
        if node_id in ids or _norm_key(name) == wanted_key or _norm_key(node_id) == wanted_key:
            ids.append(node_id)
    return _dedupe_ids(ids)


def _project_delete_ids(project_id_or_title: str) -> list[str]:
    value = unquote(str(project_id_or_title or "")).strip()
    if not value:
        return []
    ids = [value, hash_id(value)]
    wanted_key = _norm_key(value)
    for row in _query_rows("MATCH (p:Project) RETURN p.id, p.title"):
        node_id = str(row[0] or "").strip()
        title = str(row[1] or "").strip()
        if node_id in ids or _norm_key(title) == wanted_key or _norm_key(node_id) == wanted_key:
            ids.append(node_id)
    return _dedupe_ids(ids)


def _experience_delete_ids(experience_id_or_label: str) -> list[str]:
    value = unquote(str(experience_id_or_label or "")).strip()
    if not value:
        return []
    ids = [value, hash_id(value)]
    wanted_key = _norm_key(value)
    for row in _query_rows("MATCH (e:Experience) RETURN e.id, e.role, e.co"):
        node_id = str(row[0] or "").strip()
        role = str(row[1] or "").strip()
        company = str(row[2] or "").strip()
        labels = [
            node_id,
            role,
            company,
            role + company,
            " at ".join(part for part in [role, company] if part),
            " - ".join(part for part in [role, company] if part),
        ]
        if node_id in ids or hash_id(role + company) in ids or any(_norm_key(label) == wanted_key for label in labels):
            ids.append(node_id)
            ids.append(hash_id(role + company))
    return _dedupe_ids(ids)


def _text_node_ids(label: str, entry: str) -> list[str]:
    entry = unquote(str(entry or "")).strip()
    if not entry:
        return []
    wanted = {entry, hash_id(entry)}
    wanted_key = _entry_key(entry)
    ids: list[str] = []
    for row in _query_rows(f"MATCH (n:{label}) RETURN n.id, n.title"):
        node_id = str(row[0] or "").strip()
        title = str(row[1] or "").strip()
        if node_id in wanted or _entry_key(title) == wanted_key:
            ids.append(node_id)
    if not ids:
        ids.append(hash_id(entry))
    return list(dict.fromkeys(ids))


def _delete_text_node(label: str, profile_key: str, entry: str, db_path: str | None = None) -> None:
    entry = unquote(str(entry or "")).strip()
    if not entry:
        return
    delete_ids = _text_node_ids(label, entry)
    _remember_profile_deletion(profile_key, [entry, *delete_ids], db_path)
    for node_id in delete_ids:
        delete_vec_id_from_all(node_id)
        _safe_execute(f"MATCH (n:{label}) WHERE n.id = $id DETACH DELETE n", {"id": node_id})
    drop_profile_aggregate_vector()

    snapshot = normal_profile(load_profile_snapshot(db_path))
    entry_key = _entry_key(entry)
    delete_id_set = set(delete_ids)
    snapshot[profile_key] = [
        item
        for item in snapshot.get(profile_key, [])
        if _entry_key(item) != entry_key and hash_id(_entry_text(item)) not in delete_id_set
    ]
    save_profile_snapshot(snapshot, db_path, allow_empty=True)


def add_education(title: str, db_path: str | None = None) -> dict:
    return _add_text_node("Education", "HAS_EDUCATION", title, db_path)


def add_certification(title: str, db_path: str | None = None) -> dict:
    return _add_text_node("Certification", "HAS_CERTIFICATION", title, db_path)


def add_achievement(title: str, db_path: str | None = None) -> dict:
    return _add_text_node("Achievement", "HAS_ACHIEVEMENT", title, db_path)


def delete_education(entry: str, db_path: str | None = None) -> None:
    _delete_text_node("Education", "education", entry, db_path)


def delete_certification(entry: str, db_path: str | None = None) -> None:
    _delete_text_node("Certification", "certifications", entry, db_path)


def delete_achievement(entry: str, db_path: str | None = None) -> None:
    _delete_text_node("Achievement", "achievements", entry, db_path)


def update_identity(identity: dict, db_path: str | None = None) -> dict:
    clean = {key: str(identity.get(key) or "").strip() for key in IDENTITY_KEYS if key in identity}
    if clean:
        try:
            save_settings(clean, db_path) if db_path else save_settings(clean)
        except Exception as exc:
            _log.warning("identity settings save skipped: %s", exc)
    try:
        snapshot = normal_profile(load_profile_snapshot(db_path) or read_profile_from_graph())
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:update_identity: %s', log_exc)
        snapshot = empty_profile()
    snapshot["identity"] = {**snapshot.get("identity", {}), **clean}
    save_profile_snapshot(snapshot, db_path)
    return {key: str(snapshot["identity"].get(key) or "") for key in IDENTITY_KEYS}


def update_candidate(name: str, summary: str, db_path: str | None = None) -> dict:
    name = str(name or "").strip()
    summary = clean_profile_summary(str(summary or "").strip())
    candidate_id = hash_id(name or "Candidate")
    snapshot = normal_profile(load_profile_snapshot(db_path))
    snapshot["n"] = name
    snapshot["s"] = summary
    save_profile_snapshot(snapshot, db_path)
    try:
        result = execute_query("MATCH (n:Candidate) RETURN n.id LIMIT 1")
        if result is not None and result.has_next():
            row = result.get_next()
            candidate_id = str(row[0] or candidate_id)
            execute_query(
                "MATCH (n:Candidate {id: $id}) SET n.n = $n, n.s = $s",
                {"id": candidate_id, "n": name, "s": summary},
            )
        elif result is not None:
            execute_query(
                "CREATE (:Candidate {id: $id, n: $n, s: $s})",
                {"id": candidate_id, "n": name, "s": summary},
            )
    except Exception as exc:
        _log.warning("candidate graph update skipped: %s", exc)
    if not _bulk_import_active():
        try:
            add_candidate_vec(candidate_id, name, summary)
        except Exception as log_exc:
            logging.getLogger(__name__).warning('suppressed exception in backend/data/graph/profile.py:update_candidate: %s', log_exc)
            pass
        drop_profile_aggregate_vector()
    save_profile_snapshot(snapshot, db_path)
    return {"n": name, "s": summary}
