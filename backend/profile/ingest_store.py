"""Graph + vector persistence for profile ingestion.

Writes the parsed profile (C) into the Kuzu graph (candidate/skill/project/
experience/credential nodes + relationships, with skill canonicalization and
description skill-scanning) and embeds it into the LanceDB vector tables.
"""

import hashlib
import logging
import re

from core.logging import get_logger
from data.vector.connection import vec
from data.vector.embeddings import embed_texts, hash_embedding
from models.schema import C

_log = get_logger(__name__)


def _h(t: str) -> str:
    return hashlib.md5(t.encode()).hexdigest()[:12]


def _emb(texts: list[str]) -> list:
    return embed_texts(texts)


def _hash_embedding(text: str, dims: int = 384) -> list[float]:
    return hash_embedding(text, dims)


def _put_node(tbl: str, props: dict):
    pk = next(iter(props))
    try:
        from data.graph.connection import execute_query

        result = execute_query(f"MATCH (n:{tbl}) WHERE n.{pk} = ${pk} RETURN n.{pk} LIMIT 1", {pk: props[pk]})
        if result is not None and result.has_next():
            if len(props) > 1:
                sets = ", ".join(f"n.{k} = ${k}" for k in props if k != pk)
                execute_query(f"MATCH (n:{tbl}) WHERE n.{pk} = ${pk} SET {sets}", props)
            return
        cols = ", ".join(f"{k}: ${k}" for k in props)
        execute_query(f"CREATE (:{tbl} {{{cols}}})", props)
    except Exception as exc:
        if "duplicated primary key" in str(exc).lower() and len(props) > 1:
            try:
                from data.graph.connection import execute_query

                sets = ", ".join(f"n.{k} = ${k}" for k in props if k != pk)
                execute_query(f"MATCH (n:{tbl}) WHERE n.{pk} = ${pk} SET {sets}", props)
                return
            except Exception as log_exc:
                logging.getLogger(__name__).warning('suppressed exception in backend/profile/ingestor.py:_put_node: %s', log_exc)
                return
        logging.getLogger(__name__).warning('suppressed exception in backend/profile/ingestor.py:_put_node: %s', exc)


def _put_rel(a: str, aid: str, b: str, bid: str, rel: str):
    try:
        from data.graph.connection import execute_query

        execute_query(
            f"MATCH (a:{a} {{id: $s}}), (b:{b} {{id: $d}}) MERGE (a)-[:{rel}]->(b)",
            {"s": aid, "d": bid},
        )
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/profile/ingestor.py:_put_rel: %s', log_exc)
        pass


def _put_vec(name: str, rows: list):
    if not rows:
        return
    from data.graph.profile import vec_table_names

    ids = [str(row.get("id") or "") for row in rows if row.get("id")]
    if name in vec_table_names():
        table = vec.open_table(name)
        if ids:
            quoted = ["'" + item.replace("'", "''") + "'" for item in ids]
            try:
                table.delete("id IN (" + ", ".join(quoted) + ")")
            except Exception as log_exc:
                logging.getLogger(__name__).warning('suppressed exception in backend/profile/ingestor.py:_put_vec: %s', log_exc)
                pass
        table.add(rows)
    else:
        vec.create_table(name, data=rows)


def _canonical(name: str) -> str:
    """Canonicalize a skill name before graph write to prevent duplicates."""
    from profile.normalization import SKILL_CANONICAL
    return SKILL_CANONICAL.get(name.lower().strip(), name.strip())


def _graph(p: C):
    cid = _h(p.n)
    _put_node("Candidate", {"id": cid, "n": p.n, "s": p.s})

    # Track written skills to avoid duplicate nodes for aliases
    written_skills: set[str] = set()
    for sk in p.skills:
        canonical = _canonical(sk.n)
        if not canonical:
            continue
        key = canonical.lower()
        if key in written_skills:
            continue
        written_skills.add(key)
        sid = _h(canonical)
        _put_node("Skill", {"id": sid, "n": canonical, "cat": sk.cat})
        _put_rel("Candidate", cid, "Skill", sid, "HAS_SKILL")

    for e in p.exp:
        eid = _h(e.role + e.co)
        _put_node("Experience", {"id": eid, "role": e.role, "co": e.co, "period": e.period, "d": e.d})
        _put_rel("Candidate", cid, "Experience", eid, "WORKED_AS")
        # Collect skills from both explicit e.s list and by scanning description text
        exp_skills: set[str] = set(e.s or [])
        if e.d:
            from profile.normalization import SKILL_CANONICAL
            desc_lower = e.d.lower()
            for raw, canonical in SKILL_CANONICAL.items():
                if re.search(r"(?<![a-z0-9+#.-])" + re.escape(raw) + r"(?![a-z0-9+#.-])", desc_lower):
                    exp_skills.add(canonical)
        for sn in exp_skills:
            canonical = _canonical(sn)
            if not canonical:
                continue
            sid = _h(canonical)
            _put_node("Skill", {"id": sid, "n": canonical, "cat": "general"})
            _put_rel("Experience", eid, "Skill", sid, "EXP_UTILIZES")

    for pr in p.projects:
        pid = _h(pr.title)
        _put_node("Project", {
            "id": pid, "title": pr.title,
            "stack": ",".join(pr.stack), "repo": pr.repo or "", "impact": pr.impact,
        })
        _put_rel("Candidate", cid, "Project", pid, "BUILT")
        # Collect skills from explicit stack + scan title/impact for additional skills
        proj_skills: set[str] = set(pr.s or [])
        proj_skills.update(pr.stack or [])
        combined_text = f"{pr.title} {pr.impact}".lower()
        if combined_text:
            from profile.normalization import SKILL_CANONICAL
            for raw, canonical in SKILL_CANONICAL.items():
                if re.search(r"(?<![a-z0-9+#.-])" + re.escape(raw) + r"(?![a-z0-9+#.-])", combined_text):
                    proj_skills.add(canonical)
        for sn in proj_skills:
            canonical = _canonical(sn)
            if not canonical:
                continue
            sid = _h(canonical)
            _put_node("Skill", {"id": sid, "n": canonical, "cat": "general"})
            _put_rel("Project", pid, "Skill", sid, "PROJ_UTILIZES")

    for cert in getattr(p, "certifications", []) or []:
        title = str(cert or "").strip()
        if not title:
            continue
        sid = _h(title)
        _put_node("Certification", {"id": sid, "title": title})
        _put_rel("Candidate", cid, "Certification", sid, "HAS_CERTIFICATION")

    for item in getattr(p, "education", []) or []:
        title = str(item or "").strip()
        if not title:
            continue
        sid = _h(title)
        _put_node("Education", {"id": sid, "title": title})
        _put_rel("Candidate", cid, "Education", sid, "HAS_EDUCATION")

    for item in getattr(p, "achievements", []) or []:
        title = str(item or "").strip()
        if not title:
            continue
        sid = _h(title)
        _put_node("Achievement", {"id": sid, "title": title})
        _put_rel("Candidate", cid, "Achievement", sid, "HAS_ACHIEVEMENT")


def _vectors(p: C):
    try:
        s_rows = [{"id": _h(sk.n), "n": sk.n, "cat": sk.cat} for sk in p.skills]
        if s_rows:
            vecs = _emb([r["n"] for r in s_rows])
            if vecs:
                _put_vec("skills", [{**r, "vector": v} for r, v in zip(s_rows, vecs, strict=False)])

        p_rows = [
            {"id": _h(pr.title), "title": pr.title, "stack": ",".join(pr.stack), "impact": pr.impact}
            for pr in p.projects
        ]
        if p_rows:
            texts = [f"{r['title']} {r['stack']} {r['impact']}" for r in p_rows]
            vecs = _emb(texts)
            if vecs:
                _put_vec("projects", [{**r, "vector": v} for r, v in zip(p_rows, vecs, strict=False)])
    except Exception as exc:
        _log.warning("vectors skipped: %s", exc, exc_info=True)
