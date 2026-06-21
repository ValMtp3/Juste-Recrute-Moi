"""Tests for the danger-zone data reset (data/maintenance.py + the endpoint body).

The SQLite clear is verified against an injected fake connection so the test is
fast, deterministic, never touches a real database, and sidesteps the harness's
global sqlite3 fake. Graph/vector/asset clearing is stubbed per-test so the
orchestration + summary + settings-preservation logic is asserted in isolation.
"""

from __future__ import annotations

import pytest

import data.maintenance as maintenance


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class _FakeConn:
    """Minimal sqlite connection stand-in: lists tables and records DELETEs."""

    def __init__(self, tables):
        self._tables = tables
        self.deleted: list[str] = []
        self.committed = False

    def execute(self, sql, params=None):
        text = sql.strip()
        if text.upper().startswith("SELECT NAME FROM SQLITE_MASTER"):
            return _FakeCursor([{"name": t} for t in self._tables])
        if text.upper().startswith("DELETE FROM "):
            self.deleted.append(text[len("DELETE FROM "):].strip())
            return _FakeCursor([])
        return _FakeCursor([])

    def commit(self):
        self.committed = True


# A representative crm.db table set: user data + config/schema tables.
_TABLES = ["leads", "events", "error_log", "gateway_jobs", "settings", "resume_templates", "schema_migrations"]


def _inject_conn(monkeypatch, conn):
    import data.sqlite.connection as sc

    monkeypatch.setattr(sc, "get_connection", lambda *a, **k: conn)


def test_reset_sqlite_data_only_preserves_settings_and_templates(monkeypatch):
    conn = _FakeConn(_TABLES)
    _inject_conn(monkeypatch, conn)

    summary = {"sqlite_cleared": [], "errors": []}
    maintenance._reset_sqlite(summary, clear_settings=False)

    deleted = set(conn.deleted)
    # User data is wiped...
    assert {"leads", "events", "error_log", "gateway_jobs"} <= deleted
    # ...but settings, resume templates and schema bookkeeping survive.
    assert "settings" not in deleted
    assert "resume_templates" not in deleted
    assert "schema_migrations" not in deleted
    assert conn.committed is True
    assert "leads" in summary["sqlite_cleared"] and "settings" not in summary["sqlite_cleared"]


def test_reset_sqlite_full_clears_settings_and_templates(monkeypatch):
    conn = _FakeConn(_TABLES)
    _inject_conn(monkeypatch, conn)

    summary = {"sqlite_cleared": [], "errors": []}
    maintenance._reset_sqlite(summary, clear_settings=True)

    deleted = set(conn.deleted)
    assert {"leads", "events", "settings", "resume_templates"} <= deleted
    # Schema migration history is never wiped (would break the DB).
    assert "schema_migrations" not in deleted


def test_reset_all_data_orchestrates_every_store(monkeypatch):
    conn = _FakeConn(_TABLES)
    _inject_conn(monkeypatch, conn)
    # Stub the non-sqlite stores so the test never touches real Kuzu/LanceDB/disk.
    monkeypatch.setattr(maintenance, "_reset_graph", lambda s: s["graph_cleared"].append("Candidate"))
    monkeypatch.setattr(maintenance, "_reset_vectors", lambda s: s["vectors_dropped"].append("skills"))
    monkeypatch.setattr(maintenance, "_reset_assets", lambda s: s.__setitem__("assets_removed", 3))

    summary = maintenance.reset_all_data(clear_settings=False)

    assert "leads" in summary["sqlite_cleared"]
    assert "settings" not in summary["sqlite_cleared"]  # preserved by default
    assert summary["graph_cleared"] == ["Candidate"]
    assert summary["vectors_dropped"] == ["skills"]
    assert summary["assets_removed"] == 3
    assert summary["settings_cleared"] is False
    assert summary["errors"] == []


def test_reset_data_body_requires_explicit_confirm():
    from pydantic import ValidationError

    from core.types import ResetDataBody

    # The happy path: explicit confirmation.
    body = ResetDataBody(confirm="DELETE")
    assert body.confirm == "DELETE"
    assert body.clear_settings is False

    # No body / wrong token / extra field must all be rejected — a reset can never
    # fire by accident.
    with pytest.raises(ValidationError):
        ResetDataBody()
    with pytest.raises(ValidationError):
        ResetDataBody(confirm="yes")
    with pytest.raises(ValidationError):
        ResetDataBody(confirm="DELETE", surprise=True)
