# JustHireMe — Stability Roadmap

## Claude Code Terminal Prompt

Copy everything below the line into Claude Code (terminal) and let it execute.

---

```
You are working on JustHireMe, a Tauri + React + Python (FastAPI) desktop app for automated job search. The architecture is: Tauri (Rust shell) → spawns a Python sidecar (FastAPI backend) → React frontend talks to it over HTTP + WebSocket. Data: SQLite (leads/settings), Kuzu (profile graph), LanceDB (vector embeddings).

Your mission: Fix every bug listed below so the app works reliably on Windows, Mac, and Linux. After fixing each bug, write or update tests to cover the fix. Run `cd backend && python -m pytest tests/ -x -q` after each group of fixes to verify nothing regresses.

IMPORTANT RULES:
- Read each file BEFORE editing it. Understand the full context.
- Don't break existing functionality. Every fix must be backward-compatible.
- Run tests after each fix group. If tests fail, fix them before moving on.
- Delete all __pycache__ directories before running tests: `find backend -name __pycache__ -exec rm -rf {} + 2>/dev/null`
- When done with all fixes, run the FULL test suite one final time and report results.

## PHASE 1: CRITICAL — App won't work without these (fix first)

### C1: Double app creation in main.py causes duplicate scheduler and resource leak
File: `backend/main.py`, lines 59 and 81
Problem: `app = build_gateway_app(enable_services=False)` at module level (line 59) creates a scheduler and app that are never used — uvicorn runs `gateway_app` from line 81 instead. The module-level `app` leaks resources and the scheduler `_sched` gets `ensure_ghost_job` called twice.
Fix: Remove the module-level `app = build_gateway_app(enable_services=False)` on line 59. Keep only the `gateway_app = build_gateway_app(...)` inside `if __name__ == "__main__"`. If any import depends on `app` being a module-level name, make it a lazy property or move it inside a function.

### C2: LLM client has zero retry/rate-limit handling — every API error crashes the request
File: `backend/llm/client.py`, in `call_llm` and `call_raw` functions
Problem: No catch for `RateLimitError`, `APIConnectionError`, HTTP 5xx, or timeout errors from OpenAI/Anthropic SDKs. These propagate as unhandled exceptions to FastAPI → 500 to the user.
Fix: Add retry logic with exponential backoff (3 retries, 1s/2s/4s delays) for transient errors (rate limit, connection error, 5xx). Wrap in a helper like `_retry_llm_call(fn, max_retries=3)`. Catch `openai.RateLimitError`, `openai.APIConnectionError`, `anthropic.RateLimitError`, `anthropic.APIConnectionError` specifically. For permanent errors (auth, invalid request), raise immediately. Log each retry attempt.

### C3: Profile template endpoint crashes if JSON file is missing from packaged build
File: `backend/api/routers/ingestion.py`, around line 194-196
Problem: `open(template_path)` with no try/except. Missing file = unhandled FileNotFoundError = 500.
Fix: Wrap in try/except FileNotFoundError. Return a sensible default template dict if the file is missing. Also verify the template file is included in `backend.spec` data files.

### C4: Kuzu graph connection — race condition on shared `conn` object
File: `backend/data/graph/connection.py`
Problem: Module-level `conn` (kuzu.Connection) is accessed from multiple threads via `execute_query`. The `_graph_lock` (RLock) is used with a 1.5s timeout, but two threads can race through `_ensure_connection` simultaneously if neither holds the lock yet.
Fix: Make `_ensure_connection` acquire the lock internally before checking/creating the connection. Ensure `execute_query` holds the lock for the entire duration of the query execution, not just the acquire check. Consider using a dedicated single-thread executor for all graph operations instead of the shared thread pool.

## PHASE 2: HIGH — Will cause data corruption or platform-specific failures

### H1: Ghost tick overwrites lead status (approved/applied/interviewing → discarded)
File: `backend/api/scheduler.py`, around lines 89-93
Problem: `update_lead_score(job_id, score, reason, match_points, gaps)` is called without `preserve_status=True`. Leads that the user manually approved or marked as applied get their status silently overwritten during background re-evaluation.
Fix: Add `preserve_status=True` to the `update_lead_score` call in the ghost tick path. Verify by checking what `update_lead_score` does with `preserve_status` — it should skip status changes for leads in protected states.

### H2: Windows file lock uses wrong byte offset — concurrent processes don't actually lock
File: `backend/data/sqlite/connection.py`, around lines 192-196
Problem: `msvcrt.locking(lock_file.fileno(), LK_LOCK, 1)` locks 1 byte at the current cursor position. File opened with `"a+"` leaves cursor at end. Two processes lock different byte offsets → no mutual exclusion.
Fix: Add `lock_file.seek(0)` before calling `msvcrt.locking()`. This ensures both processes try to lock byte 0.

### H3: Cover letter path handling — filesystem path sent as text content to form-fill AI
File: `backend/api/routers/automation.py`, around lines 144-150
Problem: `.replace(".pdf", ".md")` is brittle. If cover letter is stored only as `.md`, the `.pdf` path check fails, and the raw filesystem path string is passed as cover letter content.
Fix: Use `pathlib.Path(cover_letter_asset).with_suffix(".md")` instead of string replace. Check both `.md` and `.pdf` paths. Read whichever exists. If neither exists, set cover_letter to empty string with a warning log.

### H4: Synchronous SQLite call in async `run_scan` blocks the event loop
File: `backend/api/routers/discovery.py`, inside `run_scan`
Problem: `cfg = repo.settings.get_settings()` is called synchronously in an async function. This blocks the event loop during the DB read.
Fix: Wrap in `cfg = await asyncio.to_thread(repo.settings.get_settings)`. Check for other sync DB calls in async functions across all routers — grep for `repo.` calls that aren't wrapped in `asyncio.to_thread` or `await`.

### H5: 300-second LLM timeout can exhaust the entire thread pool
File: `backend/llm/client.py`, line 16
Problem: `_TIMEOUT = httpx.Timeout(300.0, connect=10.0)`. All LLM calls go through `asyncio.to_thread` which uses the default thread pool. With 300s timeouts and concurrent generation jobs, ALL threads can be blocked, starving the entire application.
Fix: Create a dedicated `ThreadPoolExecutor(max_workers=4, thread_name_prefix="llm")` for LLM calls. Use `asyncio.get_event_loop().run_in_executor(llm_executor, call_llm, ...)` instead of `asyncio.to_thread`. Also reduce the timeout to 120s — if an LLM call takes 5 minutes, it's hung. Add the executor to all callers of `call_llm` and `call_raw` across the codebase.

### H6: CI release workflow uses non-existent GitHub Actions versions
File: `.github/workflows/release.yml`
Problem: `actions/checkout@v6` doesn't exist (latest is v4). `upload-artifact@v7` and `download-artifact@v8` are incompatible major versions. These will fail in CI.
Fix: Pin to stable versions: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`. Ensure upload and download use the same major version.

## PHASE 3: MEDIUM — Causes degraded experience or edge-case failures

### M1: Module-level app causes double init_sql() call
File: `backend/main.py`, line 59
Problem: Already addressed by C1 fix. Removing the module-level `app` eliminates the double `init_sql` call.
Fix: Covered by C1.

### M2: sync_profile_relationships re-acquires RLock inside locked section — fragile
File: `backend/data/graph/connection.py`
Problem: `sync_profile_relationships` acquires `_graph_lock`, then calls `execute_query` which also acquires it. Works only because RLock is reentrant. Fragile and undocumented.
Fix: Add a comment documenting the RLock requirement. OR better: add an internal `_execute_query_unlocked` function that skips the lock acquisition, and have `sync_profile_relationships` call that instead. Keep `execute_query` as the public locked API.

### M3: Rate limiter gives no useful feedback to user on 429
File: `backend/api/rate_limit.py` + routers using it
Problem: 5 requests/60s limit. User gets a bare 429 with no info about when they can retry.
Fix: Add `Retry-After` header to the 429 response. Calculate remaining cooldown from the rate limiter state. Update the frontend to show "Please wait X seconds" instead of a generic error.

### M4: Generation silently reverts lead status on transient LLM errors
File: `backend/api/routers/generation.py`, `generate_one` except block
Problem: Any generation failure (including transient network errors) reverts the lead from "tailoring" to "discovered". User must manually retry.
Fix: Distinguish transient errors (network, rate limit) from permanent errors (bad template, invalid lead). For transient errors, revert to "tailoring" (not "discovered") and set a `retry_after` field. For permanent errors, revert to "discovered" with an error message. After C2 fix adds LLM retries, most transient errors won't reach this point anyway.

### M5: No validation that sidecar binary exists before Tauri build
File: `src-tauri/tauri.conf.json`
Problem: `beforeBuildCommand` is empty. Manual builds that skip `build:sidecar` produce a bundle with no working backend.
Fix: Set `beforeBuildCommand` to a script that checks for the sidecar binary existence and fails fast if missing. Example: `node -e "const fs=require('fs'); if(!fs.existsSync('src-tauri/resources/backend/jhm-sidecar-next'+( process.platform==='win32'?'.exe':''))) { console.error('Sidecar not built! Run npm run build:sidecar first.'); process.exit(1); }"`

### M6: Portfolio ingestor has no session-level timeout for multi-page crawl
File: `backend/profile/portfolio_ingestor.py`
Problem: Individual page loads have 20s timeout but the overall crawl session (up to 100 pages) has no limit. Could run for 30+ minutes on a slow site.
Fix: Add an `asyncio.wait_for(crawl_session(), timeout=300)` wrapper (5 minute max). Catch `asyncio.TimeoutError` and return whatever was collected so far. Log the timeout.

## PHASE 4: LOW — Polish and edge cases

### L1: Synchronous file upload read blocks event loop
File: `backend/api/routers/ingestion.py`, lines 73-87
Fix: Replace `shutil.copyfileobj(file.file, tmp)` with `content = await file.read()` then `tmp.write(content)` inside `asyncio.to_thread`.

### L2: LLM base URL validation doesn't catch all localhost variants
File: `backend/llm/client.py`, lines 128-140
Fix: Use `ipaddress.ip_address(parsed.hostname)` to check if the resolved host is a loopback address, rather than string matching against a blocklist.

### L3: Lead row_get swallows ValueError from column name lookup
File: `backend/data/sqlite/leads.py`, `row_get` function
Fix: Catch `ValueError` explicitly and log it at DEBUG level so schema drift is detectable in diagnostics.

### L4: WebSocket reconnect timer leaks on component unmount
File: `src/shared/hooks/useWS.ts`, cleanup function
Fix: Add `window.clearTimeout(retryTimerRef.current)` to the cleanup function returned by the useEffect.

## VERIFICATION

After all fixes:
1. Delete all __pycache__: `find backend -name __pycache__ -exec rm -rf {} + 2>/dev/null`
2. Run full test suite: `cd backend && python -m pytest tests/ -x -q --tb=short`
3. Verify no syntax errors: `python -c "import py_compile; import glob; [py_compile.compile(f, doraise=True) for f in glob.glob('backend/**/*.py', recursive=True) if '.venv' not in f]"`
4. Check for circular imports: `cd backend && python -c "import main"` (should not hang or error)
5. Verify cross-platform paths: grep for hardcoded Windows paths (`C:\\`, `\\\\`) in Python files — there should be none except in tests.

Report: For each fix, state what you changed, what test you wrote/updated, and whether the test suite passes.
```
