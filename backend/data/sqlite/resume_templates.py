"""SQLite repository for user-managed resume templates.

A template is an uploaded resume (PDF/DOCX/TXT) whose extracted text is stored
as ``content`` and reused as the structural/formatting guide when generating a
tailored resume for a specific job. Users can keep several and pick one (or set
a default) at generation time.
"""

from __future__ import annotations

import uuid

from data.sqlite.connection import DEFAULT_DB_PATH, get_connection, init_sql

MAX_TEMPLATES = 25
MAX_CONTENT_CHARS = 60000
PREVIEW_CHARS = 280


def _ensure(db_path: str = DEFAULT_DB_PATH) -> None:
    init_sql(db_path)


def _row_to_dict(row, *, include_content: bool) -> dict:
    content = row["content"] or ""
    item = {
        "id": row["id"],
        "name": row["name"],
        "source_filename": row["source_filename"] or "",
        "is_default": bool(row["is_default"]),
        "created_at": row["created_at"],
        "char_count": len(content),
        "preview": content[:PREVIEW_CHARS],
    }
    if include_content:
        item["content"] = content
    return item


def list_templates(db_path: str = DEFAULT_DB_PATH) -> list[dict]:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        rows = conn.execute(
            "SELECT id, name, source_filename, content, is_default, created_at "
            "FROM resume_templates ORDER BY is_default DESC, created_at DESC"
        ).fetchall()
    finally:
        conn.close()
    return [_row_to_dict(row, include_content=False) for row in rows]


def get_template(template_id: str, db_path: str = DEFAULT_DB_PATH) -> dict | None:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT id, name, source_filename, content, is_default, created_at "
            "FROM resume_templates WHERE id=?",
            (template_id,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_dict(row, include_content=True) if row else None


def get_default_template(db_path: str = DEFAULT_DB_PATH) -> dict | None:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT id, name, source_filename, content, is_default, created_at "
            "FROM resume_templates WHERE is_default=1 LIMIT 1"
        ).fetchone()
    finally:
        conn.close()
    return _row_to_dict(row, include_content=True) if row else None


def count_templates(db_path: str = DEFAULT_DB_PATH) -> int:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT COUNT(*) AS c FROM resume_templates").fetchone()
    finally:
        conn.close()
    return int(row["c"] if row else 0)


def create_template(
    name: str,
    content: str,
    source_filename: str = "",
    *,
    make_default: bool | None = None,
    db_path: str = DEFAULT_DB_PATH,
) -> dict:
    name = str(name or "").strip() or "Untitled template"
    content = str(content or "").strip()
    if not content:
        raise ValueError("template content is empty (could not extract text from the upload)")
    if len(content) > MAX_CONTENT_CHARS:
        content = content[:MAX_CONTENT_CHARS]
    _ensure(db_path)
    if count_templates(db_path) >= MAX_TEMPLATES:
        raise ValueError(f"template limit reached (max {MAX_TEMPLATES}); delete one first")

    template_id = uuid.uuid4().hex
    conn = get_connection(db_path)
    try:
        existing = conn.execute("SELECT COUNT(*) AS c FROM resume_templates").fetchone()
        is_first = int(existing["c"] if existing else 0) == 0
        is_default = is_first if make_default is None else bool(make_default)
        if is_default:
            conn.execute("UPDATE resume_templates SET is_default=0")
        conn.execute(
            "INSERT INTO resume_templates(id, name, source_filename, content, is_default) "
            "VALUES(?,?,?,?,?)",
            (template_id, name, source_filename, content, 1 if is_default else 0),
        )
        conn.commit()
    finally:
        conn.close()
    return get_template(template_id, db_path)  # type: ignore[return-value]


def delete_template(template_id: str, db_path: str = DEFAULT_DB_PATH) -> bool:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT is_default FROM resume_templates WHERE id=?", (template_id,)).fetchone()
        if not row:
            return False
        was_default = bool(row["is_default"])
        conn.execute("DELETE FROM resume_templates WHERE id=?", (template_id,))
        if was_default:
            # Promote the most recent remaining template to default so generation
            # always has a sensible fallback.
            nxt = conn.execute(
                "SELECT id FROM resume_templates ORDER BY created_at DESC LIMIT 1"
            ).fetchone()
            if nxt:
                conn.execute("UPDATE resume_templates SET is_default=1 WHERE id=?", (nxt["id"],))
        conn.commit()
    finally:
        conn.close()
    return True


def set_default_template(template_id: str, db_path: str = DEFAULT_DB_PATH) -> bool:
    _ensure(db_path)
    conn = get_connection(db_path)
    try:
        row = conn.execute("SELECT id FROM resume_templates WHERE id=?", (template_id,)).fetchone()
        if not row:
            return False
        conn.execute("UPDATE resume_templates SET is_default=0")
        conn.execute("UPDATE resume_templates SET is_default=1 WHERE id=?", (template_id,))
        conn.commit()
    finally:
        conn.close()
    return True


def resolve_template_content(template_id: str = "", db_path: str = DEFAULT_DB_PATH) -> str:
    """Resolve the template text to feed the generator.

    Precedence: explicit template_id -> default template -> legacy
    `resume_template` setting -> empty string (generator's built-in layout).
    """
    if template_id:
        chosen = get_template(template_id, db_path)
        if chosen and chosen.get("content"):
            return chosen["content"]
    default = get_default_template(db_path)
    if default and default.get("content"):
        return default["content"]
    try:
        from data.sqlite.settings import get_setting

        return get_setting("resume_template", "", db_path)
    except Exception:
        return ""
