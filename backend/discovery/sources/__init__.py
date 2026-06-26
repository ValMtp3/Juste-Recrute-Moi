"""Discovery source adapters."""

from discovery.sources.ats import (
    scrape_ashby,
    scrape_direct_ats_url,
    scrape_target as scrape_ats_target,
    scrape_greenhouse,
    is_ats_target,
    scrape_lever,
    scrape_smartrecruiters,
    scrape_teamtailor,
    scrape_workable,
)
from discovery.sources.france_travail import scrape_target as scrape_france_travail_target
from discovery.sources.jobspy import scrape_target as scrape_jobspy_target
from discovery.sources.adzuna import scrape_target as scrape_adzuna_target
from discovery.sources.jooble import scrape_target as scrape_jooble_target
from discovery.sources.wttj_rss import scrape_target as scrape_wttj_target
from discovery.sources.apec import scrape_target as scrape_apec_target
from discovery.sources.url_import import scrape_target as scrape_url_import_target
from discovery.sources.apify import run_actor as run_apify_actor
from discovery.sources.apify import run_board_scan
from discovery.sources.custom import scrape_custom_connector
from discovery.sources.github_jobs import scrape_github
from discovery.sources.hackernews import scrape_hn, scrape_hn_hiring
from discovery.sources.reddit import scrape_reddit
from discovery.sources.rss import (
    scrape_jobicy_api,
    scrape_remoteok,
    scrape_remotive,
    scrape_rss,
)
from discovery.sources.x_twitter import run_x_scan
from discovery.sources.web import scrape as scrape_web
from discovery.sources.web import scrape_github_jobs_target, scrape_wellfound_target

__all__ = [
    "is_ats_target",
    "run_apify_actor",
    "run_board_scan",
    "run_x_scan",
    "scrape_ashby",
    "scrape_ats_target",
    "scrape_custom_connector",
    "scrape_direct_ats_url",
    "scrape_france_travail_target",
    "scrape_github",
    "scrape_github_jobs_target",
    "scrape_greenhouse",
    "scrape_hn",
    "scrape_hn_hiring",
    "scrape_adzuna_target",
    "scrape_jooble_target",
    "scrape_wttj_target",
    "scrape_apec_target",
    "scrape_jobicy_api",
    "scrape_jobspy_target",
    "scrape_lever",
    "scrape_reddit",
    "scrape_remoteok",
    "scrape_remotive",
    "scrape_rss",
    "scrape_smartrecruiters",
    "scrape_teamtailor",
    "scrape_url_import_target",
    "scrape_web",
    "scrape_wellfound_target",
    "scrape_workable",
]
