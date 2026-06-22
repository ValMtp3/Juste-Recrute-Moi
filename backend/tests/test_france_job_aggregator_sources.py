import asyncio
import sys
from types import SimpleNamespace
from unittest import mock

from core.config import job_market_focus, job_targets
from discovery.service import DiscoveryService
from discovery.sources import ats, france_travail, jobspy, url_import


def test_france_market_targets_prioritize_stable_and_best_effort_sources():
    targets = job_targets("", "france")

    assert job_market_focus("fr") == "france"
    assert targets[0].startswith("france_travail:")
    assert any(target.startswith("jobspy:") for target in targets)
    assert any("welcometothejungle" in target for target in targets)


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
        result = asyncio.run(service.scan_job_boards(["france_travail:developpeur"], {}))

    assert result.leads == [fake_lead]
    assert result.usage["saved"] == 1
    free_scout.assert_called_once()
