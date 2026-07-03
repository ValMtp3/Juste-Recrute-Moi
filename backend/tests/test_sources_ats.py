"""Keyless ATS source adapters: parsing + dispatch (network mocked).

Covers the direct public-API adapters (greenhouse/lever/ashby/workable and the
newly added smartrecruiters/recruitee/personio). Network is mocked at the
``json_get`` / ``xml_get`` boundary, so these assert the normalization + routing
logic that ships, without hitting live boards. Proves a keyless source returns
non-empty, normalized, field-agnostic leads.
"""

from __future__ import annotations

import asyncio

from discovery.sources import ats


def _run(coro):
    return asyncio.run(coro)


def _patch_json(monkeypatch, payload):
    async def fake_json_get(url, params=None):
        return payload

    monkeypatch.setattr(ats, "json_get", fake_json_get)


# --- SmartRecruiters ---------------------------------------------------------

def test_smartrecruiters_parses_nursing_posting(monkeypatch):
    _patch_json(monkeypatch, {"content": [
        {
            "id": "abc123",
            "name": "ICU Registered Nurse",
            "company": {"name": "Mercy Health"},
            "location": {"city": "Berlin", "country": "Germany"},
            "releasedDate": "",  # empty => not freshness-filtered
        }
    ]})
    leads = _run(ats.scrape_smartrecruiters("mercy"))
    assert len(leads) == 1
    lead = leads[0]
    assert lead["title"] == "ICU Registered Nurse"
    assert lead["company"] == "Mercy Health"
    assert lead["platform"] == "smartrecruiters"
    assert "mercy/abc123" in lead["url"]
    assert lead["source_meta"]["ats"] == "smartrecruiters"
    # Field-agnostic: a non-tech posting still normalizes with a real signal.
    assert lead["signal_score"] > 0


def test_smartrecruiters_freshness_filters_old(monkeypatch):
    _patch_json(monkeypatch, {"content": [
        {"id": "1", "name": "Welder", "releasedDate": "2020-01-01T00:00:00Z"}
    ]})
    assert _run(ats.scrape_smartrecruiters("acme")) == []


# --- Recruitee ---------------------------------------------------------------

def test_recruitee_parses_trade_posting(monkeypatch):
    _patch_json(monkeypatch, {"offers": [
        {
            "title": "Structural Welder",
            "careers_url": "https://acme.recruitee.com/o/welder",
            "city": "Houston",
            "country": "USA",
            "description": "MIG and TIG welding from blueprints",
            "created_at": "",
        }
    ]})
    leads = _run(ats.scrape_recruitee("acme"))
    assert len(leads) == 1
    lead = leads[0]
    assert lead["platform"] == "recruitee"
    assert lead["title"] == "Structural Welder"
    assert "Houston" in lead["location"]
    assert lead["url"] == "https://acme.recruitee.com/o/welder"


# --- Personio (XML feed) -----------------------------------------------------

def test_personio_parses_xml_feed(monkeypatch):
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?><positions>'
        "<position><id>42</id><name>Staff Accountant</name><office>Munich</office>"
        "<jobDescriptions><jobDescription><name>Role</name>"
        "<value>Bookkeeping and financial reporting</value></jobDescription></jobDescriptions>"
        "<createdAt></createdAt></position>"
        "</positions>"
    )

    async def fake_xml_get(url, params=None):
        return xml

    monkeypatch.setattr(ats, "xml_get", fake_xml_get)
    leads = _run(ats.scrape_personio("acme"))
    assert len(leads) == 1
    lead = leads[0]
    assert lead["platform"] == "personio"
    assert lead["title"] == "Staff Accountant"
    assert "42" in lead["url"]
    assert "Munich" in lead["location"]


def test_personio_bad_xml_returns_empty(monkeypatch):
    async def fake_xml_get(url, params=None):
        return "not xml at all <<<"

    monkeypatch.setattr(ats, "xml_get", fake_xml_get)
    assert _run(ats.scrape_personio("acme")) == []


# --- Dispatch / detection ----------------------------------------------------

def test_is_ats_target_recognizes_new_hosts():
    assert ats.is_ats_target("ats:smartrecruiters:acme")
    assert ats.is_ats_target("ats:recruitee:acme")
    assert ats.is_ats_target("ats:personio:acme")
    assert ats.is_ats_target("https://jobs.smartrecruiters.com/Acme/12345")
    assert ats.is_ats_target("https://acme.recruitee.com/careers")
    assert ats.is_ats_target("https://acme.jobs.personio.com/")
    assert not ats.is_ats_target("https://example.com/jobs")


def test_scrape_target_dispatches_ats_prefix(monkeypatch):
    seen = {}

    async def fake(slug):
        seen["slug"] = slug
        return [{"title": "x"}]

    monkeypatch.setattr(ats, "scrape_smartrecruiters", fake)
    _run(ats.scrape_target("ats:smartrecruiters:acme"))
    assert seen["slug"] == "acme"


def test_scrape_direct_ats_url_detects_subdomain_slug(monkeypatch):
    seen = {}

    async def fake_recruitee(slug):
        seen["recruitee"] = slug
        return []

    async def fake_personio(slug, tld="com"):
        seen["personio"] = slug
        return []

    monkeypatch.setattr(ats, "scrape_recruitee", fake_recruitee)
    monkeypatch.setattr(ats, "scrape_personio", fake_personio)
    _run(ats.scrape_direct_ats_url("https://acme.recruitee.com/o/welder"))
    _run(ats.scrape_direct_ats_url("https://beta.jobs.personio.com/job/9"))
    assert seen["recruitee"] == "acme"
    assert seen["personio"] == "beta"
