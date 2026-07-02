from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from discovery.targets import (
    free_sources_enabled,
    has_profile_discovery_signal,
    has_x_token,
    int_cfg,
    job_market_focus,
    profile_free_source_targets,
    profile_x_queries,
    truthy,
)


@dataclass
class DiscoveryRunResult:
    leads: list[dict] = field(default_factory=list)
    usage: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


class DiscoveryService:
    async def plan_board_targets(self, profile: dict, raw_urls: list[str], market_focus: str = "global") -> list[str]:
        from discovery.query_gen import generate

        return await asyncio.to_thread(generate, profile, raw_urls, market_focus)

    async def scan_job_boards(self, urls: list[str], cfg: dict) -> DiscoveryRunResult:
        from automation.source_adapters import run_free_scout
        from discovery.sources.apify import run_board_scan

        free_targets = [url for url in urls if _is_direct_free_target(url)]
        board_targets = [url for url in urls if not _is_direct_free_target(url)]
        if not free_targets:
            result = await asyncio.to_thread(run_board_scan, urls, cfg)
            return DiscoveryRunResult(leads=result.leads, usage=result.usage, errors=result.errors)

        leads: list[dict] = []
        errors: list[str] = []
        usage: dict = {"configured": len(urls), "executed": 0, "candidates": 0, "saved": 0, "duplicates": 0, "filtered": 0, "missing_url": 0, "empty": 0, "errors": 0, "by_source": {}}

        if free_targets:
            free_result = await asyncio.to_thread(
                run_free_scout,
                targets=free_targets,
                raw_targets="",
                raw_watchlist="",
                raw_custom_connectors="",
                raw_custom_headers=cfg.get("custom_connector_headers", ""),
                custom_connectors_enabled=False,
                kind_filter="job",
                max_requests=int_cfg(cfg, "free_source_max_requests", 20, 1, 80),
                min_signal_score=int_cfg(cfg, "free_source_min_signal_score", 60, 0, 100),
            )
            leads.extend(free_result.leads)
            errors.extend(free_result.errors)
            _merge_usage(usage, free_result.usage, configured=len(free_targets))

        if board_targets:
            board_result = await asyncio.to_thread(run_board_scan, board_targets, cfg)
            leads.extend(board_result.leads)
            errors.extend(board_result.errors)
            _merge_usage(usage, board_result.usage, configured=len(board_targets))

        return DiscoveryRunResult(leads=leads, usage=usage, errors=errors)

    async def scan_free_sources(
        self,
        cfg: dict,
        *,
        kind_filter: str | None = None,
        profile: dict | None = None,
        force: bool = False,
        progress_callback: Any | None = None,
    ) -> DiscoveryRunResult:
        if not force and not free_sources_enabled(cfg):
            return DiscoveryRunResult()

        from automation.source_adapters import run_free_scout

        raw_targets = cfg.get("free_source_targets", "") or profile_free_source_targets(profile or {})
        has_watchlist = bool(str(cfg.get("company_watchlist", "") or "").strip())
        has_connectors = truthy(cfg.get("custom_connectors_enabled", "false")) and bool(str(cfg.get("custom_connectors", "") or "").strip())
        if not str(raw_targets or "").strip() and not has_watchlist and not has_connectors:
            if has_profile_discovery_signal(profile):
                message = "Scan des sources gratuites ignoré : aucune cible exploitable n'a pu être déduite de ce profil."
            else:
                message = "Scan des sources gratuites ignoré : ajoutez un poste cible, des compétences, des cibles source ou une liste d'entreprises."
            return DiscoveryRunResult(errors=[message])

        loop = asyncio.get_running_loop()
        def sync_progress(current: int, total: int, target: str):
            if progress_callback:
                asyncio.run_coroutine_threadsafe(progress_callback(current, total, target), loop)

        result = await asyncio.to_thread(
            run_free_scout,
            raw_targets=_filter_free_targets_for_market(raw_targets, cfg.get("job_market_focus", "france")),
            raw_watchlist=cfg.get("company_watchlist", ""),
            raw_custom_connectors=cfg.get("custom_connectors", ""),
            raw_custom_headers=cfg.get("custom_connector_headers", ""),
            custom_connectors_enabled=truthy(cfg.get("custom_connectors_enabled", "false")),
            kind_filter=kind_filter or "job",
            max_requests=int_cfg(cfg, "free_source_max_requests", 20, 1, 80),
            min_signal_score=int_cfg(cfg, "free_source_min_signal_score", 60, 0, 100),
            progress_callback=sync_progress,
        )
        return DiscoveryRunResult(
            leads=result.leads,
            usage=result.usage,
            errors=result.errors,
        )

    async def scan_x(
        self,
        cfg: dict,
        *,
        kind_filter: str = "job",
        profile: dict | None = None,
    ) -> DiscoveryRunResult:
        if not has_x_token(cfg):
            return DiscoveryRunResult()

        from discovery.sources.x_twitter import run_x_scan

        result = await asyncio.to_thread(
            run_x_scan,
            bearer_token=cfg.get("x_bearer_token") or None,
            raw_queries=cfg.get("x_search_queries", "") or profile_x_queries(profile or {}, cfg.get("job_market_focus", "france")),
            raw_watchlist=cfg.get("x_watchlist", ""),
            kind_filter=kind_filter,
            max_requests=int_cfg(cfg, "x_max_requests_per_scan", 5, 1, 50),
            max_results=int_cfg(cfg, "x_max_results_per_query", 50, 10, 100),
            min_signal_score=int_cfg(cfg, "x_min_signal_score", 55, 0, 100),
        )
        return DiscoveryRunResult(
            leads=result.leads,
            usage=result.usage,
            errors=result.errors,
        )


def create_discovery_service() -> DiscoveryService:
    return DiscoveryService()


def _filter_free_targets_for_market(raw_targets: str, market_focus: str) -> str:
    if job_market_focus(market_focus) != "france":
        return str(raw_targets or "")
    lines = []
    for line in str(raw_targets or "").splitlines():
        if line.strip().lower().startswith("reddit:"):
            continue
        lines.append(line)
    return "\n".join(lines)


def _is_direct_free_target(target: str) -> bool:
    lower = str(target or "").strip().lower()
    return lower.startswith(("france_travail:", "jobspy:", "adzuna:", "jooble:", "wttj:", "apec:", "import:", "ats:"))


def _merge_usage(out: dict, incoming: dict | None, *, configured: int) -> None:
    incoming = incoming or {}
    out["configured"] = int(out.get("configured") or 0)
    out["executed"] = int(out.get("executed") or 0) + int(incoming.get("executed") or incoming.get("targets") or configured or 0)
    for key in ("candidates", "saved", "duplicates", "filtered", "missing_url", "empty", "errors"):
        out[key] = int(out.get(key) or 0) + int(incoming.get(key) or 0)
    by_source = out.setdefault("by_source", {})
    for key, value in (incoming.get("by_source") or {}).items():
        by_source[str(key)] = int(by_source.get(str(key)) or 0) + int(value or 0)
