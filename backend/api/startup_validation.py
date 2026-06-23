from __future__ import annotations

import os
from urllib.parse import urlparse

from data.repository import Repository
from gateway.discovery_config import has_x_token, job_targets, truthy


def startup_warnings(repo: Repository) -> list[str]:
    cfg = repo.settings.get_settings()
    warnings: list[str] = []

    if truthy(cfg.get("x_enabled", "false")) and not has_x_token(cfg):
        warnings.append("Le scan X est activé mais x_bearer_token est manquant.")

    # Free sources are ON by default (zero-config), and a profile supplies its own
    # derived targets at scan time, so only warn when the user EXPLICITLY enabled
    # free sources yet left no targets/boards configured — never on the default path.
    explicit_free = str(cfg.get("free_sources_enabled", "") or "").strip()
    if explicit_free and truthy(explicit_free) and not (cfg.get("free_source_targets") or cfg.get("job_boards")):
        warnings.append("Le scan des sources gratuites est activé mais aucune cible source ou jobboard n'est configuré.")

    if truthy(cfg.get("custom_connectors_enabled", "false")) and not str(cfg.get("custom_connectors") or "").strip():
        warnings.append("Les connecteurs personnalisés sont activés mais custom_connectors est vide.")

    provider = str(cfg.get("llm_provider") or "ollama").strip().lower()
    if provider and provider not in ("ollama", "claude_cli", "codex_cli"):  # CLIs use a subscription, not a key
        from llm import _ENV_NAMES, _KEY_NAMES

        key_name = _KEY_NAMES.get(provider, "")
        env_name = _ENV_NAMES.get(provider, "")
        if not (cfg.get(key_name) or os.environ.get(env_name or "")):
            warnings.append(f"Le fournisseur IA '{provider}' est sélectionné mais aucune clé API n'est configurée.")

    raw_job_boards = str(cfg.get("job_boards", "") or "")
    if raw_job_boards.strip():
        for target in job_targets(raw_job_boards, cfg.get("job_market_focus", "global")):
            lower = target.lower()
            if lower.startswith(("site:", "ats:", "github:", "hn:", "reddit:", "http://", "https://")):
                if lower.startswith(("http://", "https://")) and not urlparse(target).netloc:
                    warnings.append(f"La cible d'offres ressemble à une URL invalide : {target}")
                continue
            if "." not in target and " " not in target:
                warnings.append(f"Cible d'offres possiblement invalide ou trop large : {target}")

    return warnings


def log_startup_warnings(repo: Repository, logger) -> list[str]:
    warnings = startup_warnings(repo)
    for warning in warnings:
        logger.warning("startup config: %s", warning)
    return warnings
