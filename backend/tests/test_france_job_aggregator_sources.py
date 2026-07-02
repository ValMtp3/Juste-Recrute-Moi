import asyncio
import sys
from types import SimpleNamespace
from unittest import mock

import httpx
import pytest

from automation import free_scout
from core.config import job_market_focus, job_targets, parse_search_intent, profile_for_discovery
from discovery.service import DiscoveryService
from discovery.sources import ats, france_travail, jobspy, url_import


def test_france_market_targets_prioritize_stable_and_best_effort_sources():
    targets = job_targets("", "france")

    assert job_market_focus("fr") == "france"
    assert targets[0].startswith("france_travail:")
    assert not any(target.startswith("jobspy:") for target in targets)
    assert "https://remotive.com/api/remote-jobs" not in targets
    assert "https://jobicy.com/api/v2/remote-jobs?count=50" not in targets
    assert "https://weworkremotely.com/remote-jobs.rss" not in targets
    assert any("welcometothejungle" in target for target in targets)
    assert "site:apec.fr/candidat/recherche-emploi.html/emploi France" in targets
    assert "site:cadremploi.fr/emploi France" in targets
    assert "site:meteojob.com/jobs France" in targets
    assert "site:lesjeudis.com/jobs France" in targets
    assert "site:linkedin.com/jobs France" in targets
    assert "site:fr.indeed.com/emplois France" in targets
    assert "wttj:query=developpeur&aroundQuery=France" in targets
    assert "apec:developpeur;location=France" in targets
    assert "adzuna:developpeur;location=France;results=50" in targets
    assert "jooble:developpeur;location=France" in targets


def test_france_market_plain_search_keeps_fallback_sources():
    targets = job_targets("data, paris", "france")

    assert targets[0] == "france_travail:data;lieu=Paris;range=0-49"
    assert "wttj:query=data&aroundQuery=Paris" in targets
    assert "apec:data;location=Paris" in targets
    assert "adzuna:data;location=Paris;results=50" in targets
    assert "jooble:data;location=Paris" in targets
    assert "https://remotive.com/api/remote-jobs" not in targets
    assert "https://jobicy.com/api/v2/remote-jobs?count=50" not in targets
    assert any("welcometothejungle" in target for target in targets)


def test_france_market_targets_apply_location_radius_to_direct_sources():
    targets = job_targets(
        "",
        "france",
        search_text="data",
        location="Montpellier",
        radius_km="25",
    )

    assert targets[0] == "france_travail:data;lieu=Montpellier;range=0-49;rayon=25"
    assert "wttj:query=data&aroundQuery=Montpellier" in targets
    assert "apec:data;location=Montpellier" in targets
    assert "adzuna:data;location=Montpellier;results=50" in targets
    assert "jooble:data;location=Montpellier" in targets


def test_france_market_adds_broader_variants_outside_france_travail():
    targets = job_targets(
        "",
        "france",
        search_text="Data analyst",
        location="Lyon",
        radius_km="25",
    )

    assert targets.count("france_travail:Data analyst;lieu=Lyon;range=0-49;rayon=25") == 1
    assert "wttj:query=Data+analyst&aroundQuery=Lyon" in targets
    assert "wttj:query=Data&aroundQuery=Lyon" in targets
    assert "apec:Data;location=Lyon" in targets
    assert "adzuna:Data;location=Lyon;results=50" in targets
    assert "jooble:Data;location=Lyon" in targets


def test_france_market_remote_search_uses_direct_remote_filter():
    targets = job_targets("data Montpellier télétravail", "france", radius_km="25")

    assert targets[0] == "france_travail:data;lieu=Montpellier;range=0-49;rayon=25;teletravail=1"


def test_france_market_radius_is_bounded_or_ignored():
    bounded = job_targets("", "france", search_text="data", location="Montpellier", radius_km="250")
    invalid = job_targets("", "france", search_text="data", location="Montpellier", radius_km="large")

    assert bounded[0] == "france_travail:data;lieu=Montpellier;range=0-49;rayon=100"
    assert invalid[0] == "france_travail:data;lieu=Montpellier;range=0-49"


def test_france_market_replaces_generic_france_travail_target_with_profile_intent():
    targets = job_targets(
        "france_travail:developpeur;lieu=France;range=0-49\nsite:hellowork.com/fr-fr/emplois",
        "france",
        search_text="Développeur IA Montpellier alternance",
        location="Montpellier",
    )

    assert targets[0] == "france_travail:Développeur IA;lieu=Montpellier;range=0-49;typeContrat=APP"
    assert "site:hellowork.com/fr-fr/emplois" in targets
    assert "france_travail:developpeur;lieu=France;range=0-49" not in targets


def test_france_market_replaces_generic_direct_sources_with_profile_intent():
    targets = job_targets(
        "\n".join([
            "france_travail:developpeur;lieu=France;range=0-49",
            "wttj:query=developpeur&aroundQuery=France",
            "apec:developpeur;location=France",
            "adzuna:developpeur;location=France;results=50",
            "jooble:developpeur;location=France",
        ]),
        "france",
        search_text="Data analyst Lyon",
        location="Lyon",
        radius_km="30",
    )

    assert "france_travail:Data analyst;lieu=Lyon;range=0-49;rayon=30" in targets
    assert "wttj:query=Data+analyst&aroundQuery=Lyon" in targets
    assert "apec:Data analyst;location=Lyon" in targets
    assert "adzuna:Data analyst;location=Lyon;results=50" in targets
    assert "jooble:Data analyst;location=Lyon" in targets
    assert not any("developpeur" in target.lower() and "france" in target.lower() for target in targets)


def test_france_market_plain_search_detects_role_location_and_contract():
    targets = job_targets("data Montpellier CDI", "france")

    assert targets[0] == "france_travail:data;lieu=Montpellier;range=0-49;typeContrat=CDI"
    assert any("hellowork" in target for target in targets)


def test_france_search_intent_parses_role_location_contract_and_remote():
    intent = parse_search_intent(["data Montpellier alternance télétravail"], "France")

    assert intent is not None
    assert intent.role == "data"
    assert intent.location == "Montpellier"
    assert intent.contract == "APP"
    assert intent.remote is True


def test_france_market_plain_search_ignores_location_prepositions():
    targets = job_targets("data à Montpellier", "france")

    assert targets[0] == "france_travail:data;lieu=Montpellier;range=0-49"


def test_france_default_targets_use_profile_search_intent():
    profile = profile_for_discovery({}, {
        "job_market_focus": "france",
        "desired_position": "IA Montpellier alternance remote",
    })
    assert profile["desired_position"] == "IA"
    assert profile["_discovery_location"] == "Montpellier"
    assert profile["_discovery_radius_km"] == "25"
    assert profile["_remote_preference"] == "remote"
    targets = job_targets(
        "",
        "france",
        search_text=profile["_discovery_search_text"],
        location=profile["_discovery_location"],
        radius_km=profile["_discovery_radius_km"],
    )

    assert targets[0] == "france_travail:IA;lieu=Montpellier;range=0-49;rayon=25;teletravail=1;typeContrat=APP"


def test_france_profile_free_sources_skip_reddit():
    from discovery.targets import profile_free_source_targets

    profile = profile_for_discovery({}, {
        "job_market_focus": "france",
        "desired_position": "Développeur IA Montpellier",
    })

    targets = profile_free_source_targets(profile)

    assert "github:" in targets
    assert "hn:" in targets
    assert "reddit:" not in targets


def test_france_market_filters_explicit_reddit_free_targets():
    from discovery.service import _filter_free_targets_for_market

    raw = "github:data hiring\nreddit:forhire:data remote\nhn:data hiring"

    assert "reddit:" not in _filter_free_targets_for_market(raw, "france")
    assert "reddit:" in _filter_free_targets_for_market(raw, "global")


def test_france_travail_search_params_keep_structured_filters():
    params = france_travail._search_params("france_travail:data;lieu=Montpellier;range=0-49;rayon=25;typeContrat=CDI")

    assert params == {
        "motsCles": "data",
        "range": "0-49",
        "lieu": "Montpellier",
        "rayon": "25",
        "typeContrat": "CDI",
    }


def test_france_travail_fallback_params_drop_optional_filters():
    params = france_travail._fallback_search_params({
        "motsCles": "data",
        "range": "0-49",
        "lieu": "Montpellier",
        "rayon": "25",
        "typeContrat": "CDI",
        "teletravail": "1",
    })

    assert params == {
        "motsCles": "data",
        "range": "0-49",
        "lieu": "Montpellier",
    }


def test_france_travail_mapper_returns_stable_lead():
    lead = france_travail.offer_to_lead(france_travail.offer_from_result({
        "id": "123ABC",
        "intitule": "Developpeur Fullstack",
        "description": "<p>React et Python</p>",
        "dateCreation": "2026-06-20T10:00:00Z",
        "typeContratLibelle": "CDI",
        "entreprise": {"nom": "Acme"},
        "lieu": {"libelle": "Paris 09"},
        "salaire": {"libelle": "45000 - 55000 EUR"},
        "origineOffre": {"urlOrigine": "https://candidat.francetravail.fr/offres/recherche/detail/123ABC"},
    }))

    assert lead["platform"] == "france_travail"
    assert lead["title"] == "Developpeur Fullstack"
    assert lead["source_meta"]["source"] == "france_travail"
    assert lead["source_meta"]["source_reliability"] == "stable"
    assert lead["source_meta"]["contract_type"] == "CDI"


def test_france_travail_non_json_response_is_actionable():
    response = httpx.Response(
        200,
        headers={"content-type": "text/html"},
        text="<html>maintenance</html>",
    )

    with pytest.raises(RuntimeError) as exc:
        france_travail._json_response(response, context="recherche")

    message = str(exc.value)
    assert "réponse non JSON" in message
    assert "HTTP 200" in message
    assert "text/html" in message
    assert "maintenance" in message


def test_france_travail_empty_204_search_response_is_empty_result(monkeypatch):
    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, *args, **kwargs):
            return httpx.Response(204)

    async def fake_access_token():
        return "token"

    monkeypatch.setattr(france_travail, "_access_token", fake_access_token)
    monkeypatch.setattr(france_travail, "guarded_async_client", lambda *args, **kwargs: FakeClient())

    assert asyncio.run(france_travail._json_search({"motsCles": "data"})) == {"resultats": []}


def test_france_travail_credentials_can_come_from_settings(monkeypatch):
    monkeypatch.delenv("FRANCE_TRAVAIL_CLIENT_ID", raising=False)
    monkeypatch.delenv("FRANCE_TRAVAIL_CLIENT_SECRET", raising=False)
    fake_repo = SimpleNamespace(
        settings=SimpleNamespace(
            get_settings=lambda: {
                "france_travail_client_id": "saved-client",
                "france_travail_client_secret": "saved-secret",
            }
        )
    )

    with mock.patch("data.repository.create_repository", return_value=fake_repo):
        assert france_travail._env_client() == ("saved-client", "saved-secret")


def test_url_import_prefers_jsonld_jobposting():
    html = """
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Ingenieur Python",
        "description": "<p>Construire des APIs.</p>",
        "datePosted": "2026-06-19",
        "employmentType": "FULL_TIME",
        "hiringOrganization": {"name": "DataCo"},
        "jobLocation": {"address": {"addressLocality": "Lyon"}},
        "url": "/jobs/python"
      }
      </script>
    </head></html>
    """

    offer = url_import.offer_from_html("https://example.com/careers/python", html)

    assert offer.title == "Ingenieur Python"
    assert offer.company == "DataCo"
    assert offer.apply_url == "https://example.com/jobs/python"
    assert offer.reliability == "manual"


def test_url_import_fallback_ignores_script_and_style_text():
    html = """
    <html>
      <head><style>.title { display: none; }</style></head>
      <body>
        <script>const secret = "internal token";</script>
        <h1>Developpeur Python</h1>
        <p>Construire des APIs utiles.</p>
      </body>
    </html>
    """

    offer = url_import.offer_from_html("https://example.com/careers/python", html)

    assert "Developpeur Python" in offer.description
    assert "Construire des APIs utiles" in offer.description
    assert "internal token" not in offer.description
    assert "display: none" not in offer.description


def test_jobspy_connector_normalizes_dataframe_like_rows(monkeypatch):
    fake_module = SimpleNamespace(
        scrape_jobs=lambda **kwargs: SimpleNamespace(
            to_dict=lambda orient: [{
                "site": "indeed",
                "title": "Backend Developer",
                "company": "Acme",
                "job_url": "https://fr.indeed.com/viewjob?jk=abc",
                "city": "Paris",
                "description": "Python FastAPI",
                "date_posted": "2026-06-20",
            }]
        )
    )
    monkeypatch.setitem(sys.modules, "jobspy", fake_module)

    leads = asyncio.run(jobspy.scrape_target("jobspy:backend;location=France;sites=indeed,google;results=1"))

    assert len(leads) == 1
    assert leads[0]["platform"] == "jobspy_indeed"
    assert leads[0]["source_meta"]["source"] == "jobspy"
    assert leads[0]["source_meta"]["source_reliability"] == "best_effort"


def test_ats_target_detection_includes_france_friendly_ats():
    assert ats.is_ats_target("ats:smartrecruiters:Ubisoft2")
    assert ats.is_ats_target("ats:teamtailor:alan")
    assert ats.is_ats_target("https://jobs.smartrecruiters.com/Ubisoft2")
    assert ats.is_ats_target("https://alan.teamtailor.com/jobs")


def test_ats_target_dispatches_smartrecruiters_and_teamtailor():
    async def run():
        with mock.patch("discovery.sources.ats.scrape_smartrecruiters", return_value=[]) as smart:
            await ats.scrape_target("ats:smartrecruiters:Ubisoft2")
        smart.assert_called_once_with("Ubisoft2")

        with mock.patch("discovery.sources.ats.scrape_teamtailor", return_value=[]) as teamtailor:
            await ats.scrape_target("ats:teamtailor:alan")
        teamtailor.assert_called_once_with("alan")

    asyncio.run(run())


def test_discovery_service_routes_direct_france_targets_to_free_scout():
    service = DiscoveryService()
    fake_lead = {"title": "Developpeur", "url": "https://example.com/job"}

    with mock.patch("automation.source_adapters.run_free_scout") as free_scout:
        free_scout.return_value.leads = [fake_lead]
        free_scout.return_value.usage = {"executed": 1, "candidates": 1, "saved": 1, "by_source": {"france_travail:x": 1}}
        free_scout.return_value.errors = []
        targets = [
            "france_travail:developpeur",
            "wttj:query=developpeur&aroundQuery=France",
            "apec:developpeur;location=France",
            "adzuna:developpeur;location=France;results=50",
            "jooble:developpeur;location=France",
        ]
        result = asyncio.run(service.scan_job_boards(targets, {}))

    assert result.leads == [fake_lead]
    assert result.usage["saved"] == 1
    free_scout.assert_called_once()
    assert free_scout.call_args.kwargs["targets"] == targets


def test_free_scout_reports_key_required_sources_when_empty(monkeypatch):
    async def empty_source(_target):
        return []

    monkeypatch.setattr(free_scout, "_source_scrape_adzuna", empty_source)
    monkeypatch.setattr(free_scout, "_source_scrape_jooble", empty_source)
    monkeypatch.setattr(free_scout, "_source_adzuna_env_client", lambda: ("", ""))
    monkeypatch.setattr(free_scout, "_source_jooble_env_client", lambda: "")

    leads = free_scout.run(
        targets=[
            "adzuna:data;location=France;results=50",
            "jooble:data;location=France",
        ],
        max_requests=2,
    )

    assert leads == []
    assert free_scout.LAST_USAGE["empty"] == 2
    errors = free_scout.LAST_ERRORS
    assert any("Adzuna ignoré" in error for error in errors)
    assert any("Jooble ignoré" in error for error in errors)
