# Changelog

## 1.0.22 - 2026-05-21

- Fixed OTA runtime readiness so incomplete stale LanceDB payloads no longer count as installed.
- Added runtime-pack verification that imports LanceDB and opens a vector connection before publishing OTA assets.

## 1.0.21 - 2026-05-20

- Repaired the Windows updater flow to retry signed release downloads as a single download-and-install operation after transient response-body decode failures.
- Prevented Windows installer smoke tests from leaving the real JustHireMe uninstall registry entry pointed at a temporary test install.

## 1.0.20 - 2026-05-20

- Fixed the PyO3/LanceDB startup path so native vector import failures degrade to deterministic matching instead of blocking the app behind a restart modal.
- Removed the frontend PyO3 string heuristic that could force a restart even when the backend did not request one.
- Kept the runtime pack installer mandatory only when the pack is actually missing.

## 1.0.18 - 2026-05-20

- Fixed the Tauri ACL regression that blocked runtime-pack and updater restarts.
- Restored the Windows installer to a slim onefile sidecar and kept the heavy vector/browser runtime in the first-run OTA pack.
- Added release guardrails so CI fails if `_internal` is bundled into installers again.

## 1.0.2 - 2026-05-18

- Added the execution and stability records to the repository release branch.
- Fixed Linux CI mypy checks for Windows-only SQLite migration locking.

## 1.0.1 - 2026-05-18

- Added cross-platform `release:smoke` CI coverage across Linux, Windows, and macOS.
- Added profile-to-score-to-generate integration coverage plus startup, lead-store, generation-readiness, and scoring invariant tests.
- Tightened profile parsing utilities by replacing unsafe `as any` casts with explicit unknown narrowing.
- Fixed startup validation so built-in default job targets do not produce false broad-target warnings.

## 1.0.0 - 2026-05-18

- Added thread-local SQLite connection pooling with shutdown cleanup to reduce lock churn.
- Made WebSocket broadcast, event recording, frontend message parsing, and LLM fallback failures visible.
- Replaced race-prone scan/reevaluation globals with an atomic task registry and `/api/v1/status`.
- Isolated graph work onto a dedicated executor with lock timeouts for degraded-but-responsive graph reads.
- Added frontend state reconciliation after WebSocket reconnects plus progress indicators for long scans.
- Added sidecar stale-PID validation and capped auto-restart after crashes.
- Reworked lead row mapping to use SQLite column names instead of positional indexes.
- Added settings validation, local structured diagnostics, and release smoke coverage for core API endpoints.
- Removed the deprecated `backend/db` compatibility facade.
