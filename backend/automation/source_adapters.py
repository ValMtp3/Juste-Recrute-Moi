from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SourceAdapterResult:
    leads: list[dict] = field(default_factory=list)
    usage: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def run_free_scout(**kwargs) -> SourceAdapterResult:
    from automation import free_scout

    leads = free_scout.run(**kwargs)
    return SourceAdapterResult(
        leads=leads,
        usage=getattr(free_scout, "LAST_USAGE", {}) or {},
        errors=list(getattr(free_scout, "LAST_ERRORS", []) or []),
    )


def run_apify_scout(
    *,
    urls: list[str],
    apify_token: str | None = None,
    apify_actor: str | None = None,
    browser_scan_enabled: bool = True,
    browser_scan_concurrency: int = 4,
    browser_scan_max_targets: int = 32,
    llm_scan_mode: str = "balanced",
) -> SourceAdapterResult:
    from automation import scout

    leads = scout.run(
        urls=urls,
        apify_token=apify_token,
        apify_actor=apify_actor,
        browser_scan_enabled=browser_scan_enabled,
        browser_scan_concurrency=browser_scan_concurrency,
        browser_scan_max_targets=browser_scan_max_targets,
        llm_scan_mode=llm_scan_mode,
    )
    return SourceAdapterResult(
        leads=leads,
        usage=getattr(scout, "LAST_USAGE", {}) or {"targets": len(urls)},
        errors=list(getattr(scout, "LAST_ERRORS", []) or []),
    )


def run_x_scout(**kwargs) -> SourceAdapterResult:
    from automation import x_scout

    leads = x_scout.run(**kwargs)
    return SourceAdapterResult(
        leads=leads,
        usage=getattr(x_scout, "LAST_USAGE", {}) or {},
        errors=list(getattr(x_scout, "LAST_ERRORS", []) or []),
    )
