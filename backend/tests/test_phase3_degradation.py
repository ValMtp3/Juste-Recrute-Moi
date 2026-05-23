# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 Vasudev Siddh and vasu-devs
"""Regression tests for Phase 3 fixes:

- M4: generation distinguishes transient vs permanent errors.
- M5: tauri build refuses to run without a sidecar binary.
- M6: portfolio crawl is bounded by a session timeout.
"""

import json
from pathlib import Path

import pytest
from fastapi import HTTPException

from api.routers import generation
from profile import portfolio_ingestor

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


# ── M4 ──────────────────────────────────────────────────────────────────────

def test_transient_error_classifier():
    assert generation._is_transient_generation_error(ConnectionError("net")) is True
    assert generation._is_transient_generation_error(TimeoutError("slow")) is True
    assert generation._is_transient_generation_error(ValueError("bad template")) is False


class _FakeLeads:
    def __init__(self):
        self.statuses = []

    def get_lead_by_id(self, job_id):
        return {"job_id": job_id, "title": "T", "company": "C", "url": "http://x",
                "status": "discovered", "source_meta": {}}

    def update_lead_status(self, job_id, status):
        self.statuses.append(status)


class _FakeRepo:
    def __init__(self):
        self.leads = _FakeLeads()
        self.settings = type("S", (), {"get_setting": lambda self, k, d="": ""})()


class _FakeJob:
    job_id = "gen-1"


class _FakeJobStore:
    def __init__(self):
        self.updates = []

    def create(self, *a, **k):
        return _FakeJob()

    def update(self, *a, **k):
        self.updates.append(k)


class _FakeManager:
    def __init__(self):
        self.msgs = []

    async def broadcast(self, payload):
        self.msgs.append(payload)


class _FakeService:
    def __init__(self, exc):
        self.exc = exc

    async def generate_with_contacts(self, lead, template=""):
        raise self.exc


def _last_lead_update(manager):
    for msg in reversed(manager.msgs):
        if msg.get("type") == "LEAD_UPDATED":
            return msg["data"]
    return None


@pytest.mark.asyncio
async def test_transient_failure_keeps_tailoring_status(monkeypatch):
    monkeypatch.setattr(generation, "lead_generation_blocker", lambda lead: "")
    repo, manager, store = _FakeRepo(), _FakeManager(), _FakeJobStore()
    with pytest.raises(HTTPException) as ei:
        await generation.generate_one(
            "job1", manager, repo=repo,
            service=_FakeService(ConnectionError("network down")), job_store=store,
        )
    assert ei.value.status_code == 503
    assert ei.value.headers and "Retry-After" in ei.value.headers
    # The revert (last status) must be "tailoring", not "discovered".
    assert repo.leads.statuses[-1] == "tailoring"
    data = _last_lead_update(manager)
    assert data["status"] == "tailoring"
    assert data["source_meta"].get("retry_after") == generation._GENERATION_RETRY_AFTER_SECONDS


@pytest.mark.asyncio
async def test_permanent_failure_reverts_to_discovered(monkeypatch):
    monkeypatch.setattr(generation, "lead_generation_blocker", lambda lead: "")
    repo, manager, store = _FakeRepo(), _FakeManager(), _FakeJobStore()
    with pytest.raises(HTTPException) as ei:
        await generation.generate_one(
            "job1", manager, repo=repo,
            service=_FakeService(ValueError("bad template")), job_store=store,
        )
    assert ei.value.status_code == 500
    assert repo.leads.statuses[-1] == "discovered"
    data = _last_lead_update(manager)
    assert data["status"] == "discovered"
    assert "retry_after" not in data["source_meta"]


# ── M5 ──────────────────────────────────────────────────────────────────────

def test_tauri_before_build_checks_sidecar():
    cfg = json.loads((ROOT / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    before = cfg["build"]["beforeBuildCommand"]
    assert "check-sidecar" in before
    assert (ROOT / "scripts" / "check-sidecar.mjs").exists()


# ── M6 ──────────────────────────────────────────────────────────────────────

def test_portfolio_crawl_has_session_timeout():
    assert portfolio_ingestor._CRAWL_SESSION_TIMEOUT == 300
    assert portfolio_ingestor._CRAWL_HARD_TIMEOUT > portfolio_ingestor._CRAWL_SESSION_TIMEOUT
    # the orchestrator must wrap the crawl in asyncio.wait_for
    src = (BACKEND / "profile" / "portfolio_ingestor.py").read_text(encoding="utf-8")
    assert "asyncio.wait_for(" in src
    assert "_CRAWL_HARD_TIMEOUT" in src
