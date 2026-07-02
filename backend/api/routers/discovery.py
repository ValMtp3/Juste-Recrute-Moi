from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone

from api.dependencies import get_discovery_service, get_job_runner, get_ranking_service, get_repository
from api.rate_limit import RateLimiter, require_rate_limit
from core.logging import get_logger
from core.telemetry import record_error
from data.repository import Repository
from gateway.discovery_config import (
    free_sources_enabled,
    has_explicit_discovery_targets,
    has_profile_discovery_signal,
    has_x_token,
    int_cfg,
    job_targets,
    profile_for_discovery,
    truthy,
)


_scan_limiter = RateLimiter(3, 60)
_log = get_logger(__name__)

REEVALUATION_STATUS_LOCKS = {"approved", "applied", "interviewing", "rejected", "accepted", "discarded"}


def _scan_failed_message(exc: Exception) -> str:
    return f"Scan échoué : {exc}"


def _reeval_start_message(total: int, provider: str) -> str:
    return f"Réévaluation de {total} offre(s) via {provider}"


def _reeval_stopped_message(scored: int, total: int) -> str:
    return f"Réévaluation arrêtée après {scored}/{total} offre(s)."


def _reeval_scored_message(index: int, total: int, lead: dict, score: int) -> str:
    title = lead.get("title") or "offre sans titre"
    return f"[{index}/{total}] Score recalculé pour {title} = {score}/100"


def _reeval_error_message(lead: dict, exc: Exception) -> str:
    title = lead.get("title") or "offre sans titre"
    return f"Réévaluation échouée pour {title} : {exc}"


def _reeval_summary_message(
    *,
    scored: int,
    total: int,
    failed: int,
    fallback_count: int,
    fallback_errors: list[str],
    triaged_count: int,
) -> str:
    summary = f"Réévaluation terminée - {scored}/{total} offre(s) scorée(s)"
    if failed:
        summary += f", {failed} échec(s)"
    if fallback_count:
        score_label = "score local" if fallback_count == 1 else "scores locaux"
        summary += f", {fallback_count} {score_label}"
        if fallback_errors:
            summary += f" ({fallback_errors[0]})"
    if triaged_count:
        triage_label = "tri local" if triaged_count == 1 else "tris locaux"
        summary += f", {triaged_count} {triage_label}"
    return summary


def _reeval_failed_message(exc: Exception) -> str:
    return f"Réévaluation échouée : {exc}"


def _target_label(target: str) -> str:
    value = str(target or "").strip()
    lower = value.lower()
    if lower.startswith("site:"):
        domain = value[5:].split()[0].strip().strip('"') or "site"
        return f"site:{domain}"
    if lower.startswith(("france_travail:", "jobspy:", "adzuna:", "jooble:", "wttj:", "apec:", "ats:", "import:")):
        return value.split(";", 1)[0]
    if len(value) > 120:
        return value[:117] + "..."
    return value


def _configured(value) -> bool:
    return bool(str(value or "").strip())


def _yesno(value) -> str:
    return "oui" if _configured(value) else "non"


def _target_debug_summary(targets: list[str], *, limit: int = 10) -> str:
    labels = [_target_label(target) for target in targets[:limit]]
    suffix = f" +{len(targets) - limit}" if len(targets) > limit else ""
    return ", ".join(labels) + suffix if labels else "aucune"


def _target_kind(target: str) -> str:
    lower = str(target or "").strip().lower()
    if lower.startswith("france_travail:"):
        return "France Travail"
    if lower.startswith(("wttj:", "apec:")):
        return "jobboards directs"
    if lower.startswith(("adzuna:", "jooble:")):
        return "agrégateurs directs"
    if lower.startswith("jobspy:"):
        return "JobSpy"
    if lower.startswith("site:"):
        return "sites web"
    if lower.startswith("ats:"):
        return "ATS directs"
    if lower.startswith(("http://", "https://")):
        return "flux web/API"
    return "autres"


def _target_mix_summary(targets: list[str]) -> str:
    counts: dict[str, int] = {}
    for target in targets:
        kind = _target_kind(target)
        counts[kind] = counts.get(kind, 0) + 1
    return ", ".join(f"{kind}={count}" for kind, count in counts.items()) if counts else "aucune"


def _by_source_summary(usage: dict | None, *, limit: int = 8) -> str:
    by_source = (usage or {}).get("by_source") or {}
    if not isinstance(by_source, dict) or not by_source:
        return "aucune source détaillée"
    items = list(by_source.items())
    chunks = [f"{_target_label(str(key))}={value}" for key, value in items[:limit]]
    if len(items) > limit:
        chunks.append(f"+{len(items) - limit}")
    return ", ".join(chunks)


class TaskRegistry:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._tasks: dict[str, asyncio.Task] = {}
        self._stops: dict[str, asyncio.Event] = {}

    async def start(self, name: str, coro_factory, *, mutex_with: list[str] | None = None) -> bool:
        async with self._lock:
            for check_name in [name, *(mutex_with or [])]:
                task = self._tasks.get(check_name)
                if task and not task.done():
                    return False

            stop = asyncio.Event()
            self._stops[name] = stop

            async def _wrapper() -> None:
                try:
                    await coro_factory(stop)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    _log.error("background task %s failed: %s", name, exc)
                finally:
                    async with self._lock:
                        if self._tasks.get(name) is task:
                            self._tasks.pop(name, None)
                            self._stops.pop(name, None)

            task = asyncio.create_task(_wrapper())
            self._tasks[name] = task
            return True

    async def stop(self, name: str) -> bool:
        async with self._lock:
            task = self._tasks.get(name)
            stop = self._stops.get(name)
            if not task or task.done() or stop is None:
                return False
            stop.set()
            return True

    async def is_running(self, name: str) -> bool:
        async with self._lock:
            task = self._tasks.get(name)
            return bool(task and not task.done())

    async def status(self) -> dict[str, bool]:
        return {
            "scanning": await self.is_running("scan"),
            "reevaluating": await self.is_running("reevaluate"),
        }


TASKS = TaskRegistry()


def _merge_scan_usage(total: dict, incoming: dict, target_count: int) -> None:
    total["configured"] = total.get("configured", 0) + target_count
    for key in ("executed", "candidates", "saved", "duplicates", "filtered", "missing_url", "empty", "errors"):
        total[key] = total.get(key, 0) + int(incoming.get(key, 0) or 0)
    for key in ("browser_configured", "browser_executed", "browser_skipped"):
        total[key] = total.get(key, 0) + int(incoming.get(key, 0) or 0)
    for key in ("browser_concurrency", "llm_scan_mode"):
        if incoming.get(key) and not total.get(key):
            total[key] = incoming.get(key)
    for key, value in (incoming.get("by_source") or {}).items():
        total.setdefault("by_source", {})[key] = value


def _target_batches(urls: list[str], size: int) -> list[list[str]]:
    size = max(1, size)
    return [urls[index:index + size] for index in range(0, len(urls), size)]


def should_preserve_job_status(status: str) -> bool:
    return status in REEVALUATION_STATUS_LOCKS


async def broadcast_x_source_errors(manager, errors: list[str]) -> None:
    if not errors:
        return
    for msg in errors[:3]:
        await manager.broadcast({"type": "agent", "event": "x_source_error", "msg": f"Source X ignorée : {msg}"})
    if len(errors) > 3:
        await manager.broadcast({"type": "agent", "event": "x_source_error", "msg": f"{len(errors) - 3} requête(s) X supplémentaire(s) ignorée(s)"})


async def run_x_signal_scan(
    manager,
    cfg: dict,
    kind_filter: str | None = None,
    profile: dict | None = None,
    discovery_service=None,
) -> list[dict]:
    if not has_x_token(cfg):
        await manager.broadcast({"type": "agent", "event": "x_scout_skip", "msg": "Diagnostic X : scan ignoré, bearer token absent."})
        return []

    discovery_service = discovery_service or get_discovery_service()
    kind_filter = "job"
    label = "offres"
    await manager.broadcast({"type": "agent", "event": "x_scout_start", "msg": f"Scan X pour les {label}..."})
    result = await discovery_service.scan_x(cfg, kind_filter=kind_filter, profile=profile)
    leads = result.leads
    usage = result.usage
    await manager.broadcast({"type": "agent", "event": "x_scout_done", "msg": f"Scan X : {len(leads)} {label} trouvée(s)"})
    if usage.get("executed_queries"):
        await manager.broadcast({
            "type": "agent",
            "event": "x_scout_usage",
            "msg": f"Usage X : {usage.get('executed_queries', 0)} requête(s), {usage.get('tweets_seen', 0)} post(s) vérifié(s), {usage.get('filtered', 0)} filtré(s)",
        })
    if not leads:
        await broadcast_x_source_errors(manager, result.errors)
    hot_threshold = int_cfg(cfg, "x_hot_lead_threshold", 80, 1, 100)
    notify_hot = truthy(cfg.get("x_enable_notifications"))
    for lead in leads:
        await manager.broadcast({"type": "LEAD_UPDATED", "data": lead})
        if (lead.get("signal_score") or 0) >= hot_threshold:
            await manager.broadcast({"type": "HOT_X_LEAD", "data": lead})
            if notify_hot:
                await manager.broadcast({"type": "agent", "event": "x_hot_lead", "msg": f"Offre X prioritaire : {lead.get('title','?')} @ {lead.get('company','?')}"})
    return leads


async def run_free_source_scan(
    manager,
    cfg: dict,
    kind_filter: str | None = None,
    profile: dict | None = None,
    force: bool = False,
    discovery_service=None,
) -> tuple[list[dict], dict, list[str]]:
    if not force and not free_sources_enabled(cfg):
        await manager.broadcast({"type": "agent", "event": "free_scout_skip", "msg": "Diagnostic sources gratuites : scan ignoré, option désactivée."})
        return [], {}, []

    discovery_service = discovery_service or get_discovery_service()
    kind_filter = "job"
    label = "offres"
    await manager.broadcast({"type": "agent", "event": "free_scout_start", "msg": f"Scan des sources gratuites pour les {label}..."})
    async def on_progress(current: int, total: int, target: str):
        await manager.broadcast({
            "type": "agent",
            "event": "scan_progress",
            "msg": f"Exploration de {target} ({current}/{total})...",
            "current": current,
            "total": total,
            "target": target
        })

    try:
        result = await discovery_service.scan_free_sources(cfg, kind_filter=kind_filter, profile=profile, force=force, progress_callback=on_progress)
    except Exception as exc:
        # Ferme l'entrée d'activité websocket avant de propager l'erreur, pour
        # éviter qu'un libellé de scan reste affiché sans événement terminal.
        await manager.broadcast({"type": "agent", "event": "free_scout_done", "msg": f"Scan des sources gratuites échoué : {exc}"})
        raise
    leads = result.leads
    usage = result.usage
    await manager.broadcast({
        "type": "agent",
        "event": "free_scout_done",
        "msg": (
            f"Sources gratuites : {len(leads)} nouvelle(s) {label} "
            f"({usage.get('candidates', 0)} candidat(s), {usage.get('duplicates', 0)} doublon(s), "
            f"{usage.get('filtered', 0)} filtrée(s), {usage.get('empty', 0)} source(s) vide(s), "
            f"{usage.get('executed', 0)} source(s) vérifiée(s))"
        ),
    })
    await manager.broadcast({
        "type": "agent",
        "event": "free_scout_sources",
        "msg": f"Diagnostic sources gratuites : {_by_source_summary(usage)}",
    })
    for msg in result.errors[:4]:
        record_error("free_source_fetch_failed", msg, "api.discovery")
        await manager.broadcast({"type": "agent", "event": "free_source_error", "msg": f"Détail source gratuite : {msg}"})
    for lead in leads:
        await manager.broadcast({"type": "LEAD_UPDATED", "data": lead})
    return leads, usage, result.errors


def _finalize_job(job_store, job_id: str, *, status: str, error: str = "") -> None:
    """Mark a persisted job terminal unless the run already did so.

    Without this, a failed or stopped scan leaves its job row at
    "running, progress 5" forever (job rows survive restarts).
    """
    try:
        record = job_store.get(job_id)
        if record and record.status in ("succeeded", "failed", "cancelled"):
            return
        job_store.update(job_id, status=status, progress=100, error=error or None)
    except Exception as log_exc:
        _log.warning('suppressed exception in backend/api/routers/discovery.py:_finalize_job: %s', log_exc)


async def run_scan(
    manager,
    *,
    repo: Repository | None = None,
    discovery_service=None,
    ranking_service=None,
    stop_event: asyncio.Event | None = None,
) -> None:
    stop_event = stop_event or asyncio.Event()
    job_store = get_job_runner()
    job = job_store.create("scan", {})
    job_store.update(job.job_id, status="running", progress=5)
    try:
        await _run_scan_inner(
            manager,
            repo=repo,
            discovery_service=discovery_service,
            ranking_service=ranking_service,
            stop_event=stop_event,
            job_store=job_store,
            job=job,
        )
    except Exception as exc:
        _finalize_job(job_store, job.job_id, status="failed", error=str(exc))
        raise
    else:
        _finalize_job(job_store, job.job_id, status="cancelled" if stop_event.is_set() else "succeeded")


async def _run_scan_inner(
    manager,
    *,
    repo: Repository | None,
    discovery_service,
    ranking_service,
    stop_event: asyncio.Event,
    job_store,
    job,
) -> None:
    repo = repo or get_repository()
    discovery_service = discovery_service or get_discovery_service()
    ranking_service = ranking_service or get_ranking_service()
    # H4: these are synchronous SQLite reads; run them off the event loop so a
    # slow/locked DB doesn't block all other coroutines.
    cfg = await asyncio.to_thread(repo.settings.get_settings)
    profile = profile_for_discovery(await asyncio.to_thread(repo.profile.get_profile), cfg)
    if not has_profile_discovery_signal(profile) and not has_explicit_discovery_targets(cfg):
        msg = "Scan ignoré : ajoutez un poste cible, des compétences, une expérience ou une source d'offres explicite."
        await manager.broadcast({"type": "agent", "event": "scan_skipped", "msg": msg})
        job_store.update(job.job_id, status="cancelled", progress=100, error=msg)
        return

    market_focus = cfg.get("job_market_focus", "france")
    discovery_location = str(profile.get("_discovery_location") or "").strip() or "non précisée"
    discovery_radius = str(profile.get("_discovery_radius_km") or "").strip() or "auto"
    raw_urls = job_targets(
        cfg.get("job_boards", ""),
        market_focus,
        search_text=str(profile.get("_discovery_search_text") or profile.get("desired_position") or profile.get("s") or ""),
        location=str(profile.get("_discovery_location") or ""),
        radius_km=str(profile.get("_discovery_radius_km") or ""),
    )
    await manager.broadcast({
        "type": "agent",
        "event": "scan_debug_config",
        "msg": (
            f"Diagnostic scan : marché={market_focus}, profil={'oui' if has_profile_discovery_signal(profile) else 'non'}, "
            f"localisation={discovery_location}, rayon={discovery_radius} km, "
            f"sources gratuites={'on' if free_sources_enabled(cfg) else 'off'}, X token={_yesno(cfg.get('x_bearer_token'))}, "
            f"Apify token={_yesno(cfg.get('apify_token'))}, actor={cfg.get('apify_actor') or 'défaut'}, "
            f"France Travail id={_yesno(cfg.get('france_travail_client_id'))}/secret={_yesno(cfg.get('france_travail_client_secret'))}, "
            f"LinkedIn cible={'oui' if any('linkedin.com/jobs' in target.lower() for target in raw_urls) else 'non'}, "
            f"LLM={cfg.get('llm_provider', 'ollama')}, embeddings={cfg.get('embedding_provider', 'onnx')}, "
            f"navigateur={cfg.get('browser_scan_enabled', 'true')}@{int_cfg(cfg, 'browser_scan_concurrency', 4, 1, 8)}, "
            f"mode IA scan={cfg.get('llm_scan_mode', 'balanced') or 'balanced'}"
        ),
    })
    await manager.broadcast({
        "type": "agent",
        "event": "scan_debug_targets",
        "msg": f"Diagnostic cibles brutes ({len(raw_urls)}) : {_target_debug_summary(raw_urls)}. Mix : {_target_mix_summary(raw_urls)}",
    })
    await run_x_signal_scan(manager, cfg, "job", profile, discovery_service=discovery_service)
    await run_free_source_scan(manager, cfg, "job", profile, discovery_service=discovery_service)

    await manager.broadcast({"type": "agent", "event": "query_gen_start", "msg": "Préparation des requêtes adaptées au profil..."})
    try:
        urls = await discovery_service.plan_board_targets(profile, raw_urls, market_focus)
        await manager.broadcast({"type": "agent", "event": "query_gen_done", "msg": f"Plan de recherche prêt : {len(urls)} cible(s)"})
        for url in urls:
            await manager.broadcast({"type": "agent", "event": "query_gen_target", "msg": _target_label(url)})
    except Exception as exc:
        urls = raw_urls
        await manager.broadcast({"type": "agent", "event": "query_gen_error", "msg": f"Génération des requêtes échouée ({exc}) ; sources brutes utilisées"})

    await manager.broadcast({"type": "agent", "event": "scout_start", "msg": f"Lancement du scan sur {len(urls)} cible(s)..."})
    leads: list[dict] = []
    scout_usage: dict = {"configured": 0, "executed": 0, "candidates": 0, "saved": 0, "duplicates": 0, "filtered": 0, "missing_url": 0, "empty": 0, "errors": 0, "by_source": {}}
    scout_errors: list[str] = []
    batch_size = int_cfg(cfg, "board_scan_batch_size", 4, 1, 12)
    batches = _target_batches(urls, batch_size)
    for batch_index, batch in enumerate(batches, start=1):
        if stop_event.is_set():
            break
        direct_targets = [target for target in batch if str(target).lower().startswith(("france_travail:", "jobspy:", "adzuna:", "jooble:", "wttj:", "apec:", "import:", "ats:"))]
        board_targets = [target for target in batch if target not in direct_targets]
        await manager.broadcast({
            "type": "agent",
            "event": "scout_batch_start",
            "msg": (
                f"Lot jobboard {batch_index}/{len(batches)} : {len(batch)} cible(s), "
                f"{len(direct_targets)} directe(s), {len(board_targets)} via Apify/browser. "
                f"Cibles : {_target_debug_summary(batch, limit=6)}"
            ),
        })
        try:
            scout_result = await discovery_service.scan_job_boards(batch, cfg)
            leads.extend(scout_result.leads)
            _merge_scan_usage(scout_usage, scout_result.usage or {}, len(batch))
            scout_errors.extend(scout_result.errors or [])
            await manager.broadcast({
                "type": "agent",
                "event": "scout_batch_done",
                "msg": (
                    f"Lot jobboard {batch_index}/{len(batches)} terminé : "
                    f"{len(scout_result.leads)} offre(s), "
                    f"{(scout_result.usage or {}).get('candidates', 0)} candidat(s), "
                    f"{(scout_result.usage or {}).get('duplicates', 0)} doublon(s), "
                    f"{(scout_result.usage or {}).get('filtered', 0)} filtrée(s), "
                    f"{(scout_result.usage or {}).get('empty', 0)} source(s) vide(s). "
                    f"Détail : {_by_source_summary(scout_result.usage)}"
                ),
            })
        except Exception as exc:
            scout_usage["configured"] += len(batch)
            scout_usage["errors"] += len(batch)
            detail = str(exc).strip() or type(exc).__name__
            scout_errors.append(f"lot jobboard {batch_index}/{len(batches)} ignoré ({len(batch)} cible(s)) : {detail}")
            record_error("source_fetch_failed", detail, "api.discovery")
            await manager.broadcast({
                "type": "agent",
                "event": "scout_batch_error",
                "msg": f"Lot jobboard {batch_index}/{len(batches)} échoué : {detail}",
            })

    await manager.broadcast({
        "type": "agent",
        "event": "scout_done",
        "msg": (
            f"Scan terminé : {len(leads)} nouvelle(s) offre(s) "
            f"({scout_usage.get('candidates', 0)} candidat(s), {scout_usage.get('duplicates', 0)} doublon(s), "
            f"{scout_usage.get('filtered', 0)} filtrée(s), {scout_usage.get('empty', 0)} source(s) vide(s), "
            f"{scout_usage.get('errors', 0)} erreur(s) source, "
            f"{scout_usage.get('browser_executed', 0)}/{scout_usage.get('browser_configured', 0)} cible(s) navigateur)"
        ),
    })
    for msg in scout_errors[:5]:
        record_error("source_fetch_failed", msg, "api.discovery")
        await manager.broadcast({"type": "agent", "event": "scout_source_detail", "msg": f"Détail source jobboard : {msg}"})

    if stop_event.is_set():
        await manager.broadcast({"type": "agent", "event": "eval_done", "msg": "Scan arrêté après la collecte."})
        return

    discovered = await asyncio.to_thread(repo.leads.get_discovered_leads)
    # Only score leads that haven't been scored yet (status 'discovered'). Leads
    # already scored ('matched'/'discarded') are re-ranked via the explicit
    # re-evaluate action — re-scoring the whole backlog on every scan is an O(N)
    # LLM cost that grows unboundedly as matched leads accumulate.
    to_score = [lead for lead in discovered if (lead.get("status") or "discovered") == "discovered"]
    await manager.broadcast({"type": "agent", "event": "eval_start", "msg": f"Évaluation de {len(to_score)} nouvelle(s) offre(s) via {cfg.get('llm_provider', 'ollama')}"})

    fallback_count = 0
    fallback_errors: list[str] = []
    prefiltered_count = 0
    triaged_count = 0
    for lead in to_score:
        if stop_event.is_set():
            await manager.broadcast({"type": "agent", "event": "eval_done", "msg": "Scan arrêté pendant l'évaluation."})
            return
        try:
            result = await ranking_service.evaluate_lead(lead, profile)
            await asyncio.to_thread(
                repo.leads.update_lead_score,
                lead["job_id"], result["score"], result["reason"],
                result.get("match_points", []), result.get("gaps", []),
                False, result.get("scored_by", ""),
            )
            if result.get("scored_by") == "deterministic_fallback":
                fallback_count += 1
                error = str(result.get("fallback_error") or "LLM indisponible").strip()
                if error and error not in fallback_errors:
                    fallback_errors.append(error)
                if fallback_count <= 3:
                    await manager.broadcast({
                        "type": "agent",
                        "event": "eval_llm_fallback",
                        "msg": f"Évaluation IA indisponible pour {lead.get('title','')} : {error}. Score local utilisé.",
                    })
            if result.get("scored_by") == "prefiltered_off_field":
                prefiltered_count += 1
            if result.get("scored_by") == "deterministic_triage":
                triaged_count += 1
            await manager.broadcast({"type": "LEAD_UPDATED", "data": {**lead, **result}})
            await manager.broadcast({"type": "agent", "event": "eval_scored", "msg": f"Score {lead.get('title','')} = {result['score']}/100"})
        except Exception as exc:
            await manager.broadcast({"type": "agent", "event": "eval_error", "msg": f"Évaluation échouée pour {lead.get('title','')} : {exc}"})

    if prefiltered_count > 0:
        await manager.broadcast({
            "type": "agent",
            "event": "eval_prefilter_summary",
            "msg": f"{prefiltered_count}/{len(to_score)} offre(s) ignorée(s) hors cible (aucun token LLM utilisé)",
        })
    if triaged_count > 0:
        await manager.broadcast({
            "type": "agent",
            "event": "eval_triage_summary",
            "msg": f"{triaged_count}/{len(to_score)} offre(s) gardée(s) au score local selon le mode IA {cfg.get('llm_scan_mode', 'balanced') or 'balanced'}",
        })
    if fallback_count > 0:
        detail = f" Dernière erreur : {fallback_errors[0]}" if fallback_errors else ""
        await manager.broadcast({
            "type": "agent",
            "event": "eval_fallback_summary",
            "msg": f"{fallback_count}/{len(to_score)} offre(s) scorée(s) par repli local (LLM indisponible).{detail}",
        })
    await manager.broadcast({"type": "agent", "event": "eval_done", "msg": "Cycle d'évaluation terminé"})
    await asyncio.to_thread(repo.settings.save_settings, {"last_scan_finished_at": datetime.now(timezone.utc).isoformat()})
    job_store.update(job.job_id, status="succeeded", progress=100)


async def run_scan_task(
    manager,
    logger,
    *,
    repo: Repository | None = None,
    discovery_service=None,
    ranking_service=None,
    stop_event: asyncio.Event | None = None,
) -> None:
    try:
        await run_scan(
            manager,
            repo=repo,
            discovery_service=discovery_service,
            ranking_service=ranking_service,
            stop_event=stop_event,
        )
    except Exception as exc:
        logger.error("scan failed: %s", exc)
        await manager.broadcast({"type": "agent", "event": "eval_done", "msg": _scan_failed_message(exc)})


async def run_reevaluate_jobs(
    manager,
    *,
    repo: Repository | None = None,
    ranking_service=None,
    stop_event: asyncio.Event | None = None,
) -> None:
    stop_event = stop_event or asyncio.Event()
    job_store = get_job_runner()
    job = job_store.create("reevaluate", {})
    job_store.update(job.job_id, status="running", progress=5)
    try:
        await _run_reevaluate_jobs_inner(
            manager,
            repo=repo,
            ranking_service=ranking_service,
            stop_event=stop_event,
            job_store=job_store,
            job=job,
        )
    except Exception as exc:
        _finalize_job(job_store, job.job_id, status="failed", error=str(exc))
        raise
    else:
        _finalize_job(job_store, job.job_id, status="cancelled" if stop_event.is_set() else "succeeded")


async def _run_reevaluate_jobs_inner(
    manager,
    *,
    repo: Repository | None,
    ranking_service,
    stop_event: asyncio.Event,
    job_store,
    job,
) -> None:
    repo = repo or get_repository()
    ranking_service = ranking_service or get_ranking_service()
    cfg = await asyncio.to_thread(repo.settings.get_settings)
    profile = await asyncio.to_thread(repo.profile.get_profile)
    jobs = await asyncio.to_thread(repo.leads.get_job_leads_for_evaluation)
    total = len(jobs)
    scored = 0
    failed = 0
    fallback_count = 0
    fallback_errors: list[str] = []
    triaged_count = 0

    await manager.broadcast({
        "type": "agent",
        "event": "reeval_start",
        "msg": _reeval_start_message(total, cfg.get("llm_provider", "ollama")),
    })

    for index, lead in enumerate(jobs, start=1):
        if stop_event.is_set():
            await manager.broadcast({
                "type": "agent",
                "event": "reeval_done",
                "msg": _reeval_stopped_message(scored, total),
            })
            return

        try:
            result = await ranking_service.evaluate_lead(lead, profile)
            preserve_status = should_preserve_job_status(lead.get("status", ""))
            await asyncio.to_thread(
                repo.leads.update_lead_score,
                lead["job_id"], result["score"], result["reason"],
                result.get("match_points", []), result.get("gaps", []),
                preserve_status, result.get("scored_by", ""),
            )
            if result.get("scored_by") == "deterministic_fallback":
                fallback_count += 1
                error = str(result.get("fallback_error") or "LLM indisponible").strip()
                if error and error not in fallback_errors:
                    fallback_errors.append(error)
                if fallback_count <= 3:
                    await manager.broadcast({
                        "type": "agent",
                        "event": "reeval_llm_fallback",
                        "msg": f"Réévaluation IA indisponible pour {lead.get('title','')} : {error}. Score local utilisé.",
                    })
            if result.get("scored_by") == "deterministic_triage":
                triaged_count += 1
            saved = await asyncio.to_thread(repo.leads.get_lead_by_id, lead["job_id"])
            await manager.broadcast({"type": "LEAD_UPDATED", "data": saved or {**lead, **result}})
            scored += 1
            await manager.broadcast({
                "type": "agent",
                "event": "reeval_scored",
                "msg": _reeval_scored_message(index, total, lead, result["score"]),
            })
        except Exception as exc:
            failed += 1
            await manager.broadcast({
                "type": "agent",
                "event": "reeval_error",
                "msg": _reeval_error_message(lead, exc),
            })

    summary = _reeval_summary_message(
        scored=scored,
        total=total,
        failed=failed,
        fallback_count=fallback_count,
        fallback_errors=fallback_errors,
        triaged_count=triaged_count,
    )
    await manager.broadcast({"type": "agent", "event": "reeval_done", "msg": summary})
    job_store.update(job.job_id, status="succeeded", progress=100, result={"scored": scored, "failed": failed, "total": total})


async def run_reevaluate_jobs_task(
    manager,
    logger,
    *,
    repo: Repository | None = None,
    ranking_service=None,
    stop_event: asyncio.Event | None = None,
) -> None:
    try:
        await run_reevaluate_jobs(manager, repo=repo, ranking_service=ranking_service, stop_event=stop_event)
    except Exception as exc:
        logger.error("reevaluate failed: %s", exc)
        await manager.broadcast({"type": "agent", "event": "reeval_done", "msg": _reeval_failed_message(exc)})


def create_router(
    *,
    manager,
    logger,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1", tags=["discovery"])

    @router.post("/scan")
    async def scan(
        repo: Repository = Depends(get_repository),
        discovery_service=Depends(get_discovery_service),
        ranking_service=Depends(get_ranking_service),
    ):
        require_rate_limit(_scan_limiter)
        started = await TASKS.start(
            "scan",
            lambda stop: run_scan_task(
                manager,
                logger,
                repo=repo,
                discovery_service=discovery_service,
                ranking_service=ranking_service,
                stop_event=stop,
            ),
            mutex_with=["reevaluate"],
        )
        if not started:
            status = await TASKS.status()
            detail = "Réévaluation déjà en cours" if status["reevaluating"] else "Scan déjà en cours"
            raise HTTPException(status_code=409, detail=detail)
        return {"status": "scanning"}

    @router.get("/status")
    async def task_status():
        return await TASKS.status()

    @router.post("/scan/stop")
    async def stop_scan():
        if not await TASKS.stop("scan"):
            return {"status": "idle"}
        await manager.broadcast({"type": "agent", "event": "eval_done", "msg": "Scan arrêté par l'utilisateur."})
        return {"status": "stopping"}

    @router.post("/leads/reevaluate")
    async def reevaluate_jobs(
        repo: Repository = Depends(get_repository),
        ranking_service=Depends(get_ranking_service),
    ):
        started = await TASKS.start(
            "reevaluate",
            lambda stop: run_reevaluate_jobs_task(
                manager,
                logger,
                repo=repo,
                ranking_service=ranking_service,
                stop_event=stop,
            ),
            mutex_with=["scan"],
        )
        if not started:
            status = await TASKS.status()
            detail = "Scan déjà en cours" if status["scanning"] else "Réévaluation déjà en cours"
            raise HTTPException(status_code=409, detail=detail)
        return {"status": "reevaluating"}

    @router.post("/leads/reevaluate/stop")
    async def stop_reevaluate_jobs():
        if not await TASKS.stop("reevaluate"):
            return {"status": "idle"}
        await manager.broadcast({"type": "agent", "event": "reeval_done", "msg": "Réévaluation arrêtée par l'utilisateur."})
        return {"status": "stopping"}

    @router.post("/leads/cleanup")
    async def cleanup_leads(
        dry_run: bool = False,
        limit: int = 1000,
        repo: Repository = Depends(get_repository),
    ):
        await manager.broadcast({
            "type": "agent",
            "event": "cleanup_start",
            "msg": f"Scan de {limit} offre(s) maximum pour détecter les données invalides...",
        })
        result = await asyncio.to_thread(repo.leads.cleanup_bad_leads, limit, dry_run)

        if not dry_run:
            for item in result.get("items", [])[:100]:
                lead = await asyncio.to_thread(repo.leads.get_lead_by_id, item["job_id"])
                if lead:
                    await manager.broadcast({"type": "LEAD_UPDATED", "data": lead})

        action = "seraient écartée(s)" if dry_run else "écartée(s)"
        await manager.broadcast({
            "type": "agent",
            "event": "cleanup_done",
            "msg": f"Nettoyage : {result['scanned']} offre(s) vérifiée(s), {result['candidates']} ligne(s) invalide(s) {action}.",
        })
        return result

    @router.post("/free-sources/scan")
    async def free_sources_scan(repo: Repository = Depends(get_repository)):
        cfg = await asyncio.to_thread(repo.settings.get_settings)  # H4: off event loop
        profile = profile_for_discovery(await asyncio.to_thread(repo.profile.get_profile), cfg)
        leads, usage, errors = await run_free_source_scan(manager, cfg, "job", profile, force=True)
        return {"status": "done", "leads": len(leads), "usage": usage, "errors": errors[:8]}

    return router
