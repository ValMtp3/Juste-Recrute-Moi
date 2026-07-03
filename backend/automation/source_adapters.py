from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class SourceAdapterResult:
    leads: list[dict] = field(default_factory=list)
    usage: dict = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _drain(module, run: Callable[[], list[dict]], fallback_usage: dict | None = None) -> SourceAdapterResult:
    """Return per-call usage/errors instead of racing on module globals."""
    sink: dict = {}
    token = module._RESULT_SINK.set(sink)
    try:
        leads = run()
    finally:
        module._RESULT_SINK.reset(token)
    usage = sink.get("usage")
    if usage is None:
        usage = getattr(module, "LAST_USAGE", {}) or dict(fallback_usage or {})
    errors = sink.get("errors")
    if errors is None:
        errors = getattr(module, "LAST_ERRORS", []) or []
    return SourceAdapterResult(leads=leads, usage=usage or {}, errors=list(errors))


def run_free_scout(**kwargs) -> SourceAdapterResult:
    from automation import free_scout

    return _drain(free_scout, lambda: free_scout.run(**kwargs))


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

    return _drain(
        scout,
        lambda: scout.run(
            urls=urls,
            apify_token=apify_token,
            apify_actor=apify_actor,
            browser_scan_enabled=browser_scan_enabled,
            browser_scan_concurrency=browser_scan_concurrency,
            browser_scan_max_targets=browser_scan_max_targets,
            llm_scan_mode=llm_scan_mode,
        ),
        fallback_usage={"targets": len(urls)},
    )


def run_x_scout(**kwargs) -> SourceAdapterResult:
    from automation import x_scout

    return _drain(x_scout, lambda: x_scout.run(**kwargs))
