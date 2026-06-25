from __future__ import annotations

from importlib import import_module


def _targets():
    return import_module("discovery.targets")


def free_sources_enabled(cfg: dict) -> bool:
    return _targets().free_sources_enabled(cfg)


def has_explicit_discovery_targets(cfg: dict) -> bool:
    return _targets().has_explicit_discovery_targets(cfg)


def has_profile_discovery_signal(profile: dict | None) -> bool:
    return _targets().has_profile_discovery_signal(profile)


def has_x_token(cfg: dict) -> bool:
    return _targets().has_x_token(cfg)


def int_cfg(cfg: dict, key: str, default: int, min_value: int, max_value: int) -> int:
    return _targets().int_cfg(cfg, key, default, min_value, max_value)


def job_targets(
    raw: str,
    market_focus: str = "global",
    *,
    search_text: str = "",
    location: str = "",
) -> list[str]:
    return _targets().job_targets(raw, market_focus, search_text=search_text, location=location)


def profile_for_discovery(profile: dict | None, cfg: dict) -> dict:
    return _targets().profile_for_discovery(profile, cfg)


def truthy(value) -> bool:
    return _targets().truthy(value)
