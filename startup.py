#!/usr/bin/env python3
"""Juste Recrute Moi — one-command local startup.

Run this and nothing else:

    python startup.py             # ensure the whole local environment, then launch
    python startup.py --no-run    # set everything up but don't launch (CI / first-time)
    python startup.py --force      # also re-fetch/refresh the runtime assets

It is IDEMPOTENT — it checks what's already in place and only does the missing
work, then starts the app:

  1. prerequisites: `uv` and `pnpm` are on PATH
  2. backend Python deps        -> `uv sync` (applies the lockfile)
  3. frontend deps              -> `pnpm install` (only if node_modules is missing)
  4. ONNX embedding model       -> downloaded into the dev sidecar's app-data dir
                                   (so semantic search works in dev instead of the
                                   hash fallback) — skipped if already present
  5. Playwright Chromium        -> installed (portfolio crawl / web scout) — skipped
                                   if already present
  6. launch                     -> `pnpm tauri dev`

No manual downloads, no figuring things out. Just `python startup.py`.
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"

# Windows consoles default to cp1252, which can't encode fancy glyphs; force UTF-8
# (and keep all our own markers ASCII below) so output never crashes the script.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Tauri bundle identifier — keep in sync with src-tauri/tauri.conf.json. The dev
# sidecar reads its app-data dir from here (Tauri sets JHM_APP_DATA_DIR to it).
APP_IDENTIFIER = "com.valentinfiess.justerecrutemoi"

_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if _USE_COLOR else text


def step(msg: str) -> None:
    print("\n" + _c(f"==> {msg}", "1;36"), flush=True)


def ok(msg: str) -> None:
    print("  " + _c("[ok]", "32") + f" {msg}", flush=True)


def fail(msg: str) -> "None":
    sys.exit("  " + _c("[error]", "31") + f" {msg}")


def app_data_dir() -> Path:
    """Mirror Tauri's app_data_dir() per-OS so assets land where the dev sidecar reads them."""
    system = platform.system()
    if system == "Windows":
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    elif system == "Darwin":
        base = str(Path.home() / "Library" / "Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or str(Path.home() / ".local" / "share")
    return Path(base) / APP_IDENTIFIER


def run(command: str, *, cwd: Path | None = None, env: dict | None = None, stdin_text: str | None = None) -> int:
    """Run a shell command (string form so Windows finds uv/pnpm shims). Streams output."""
    merged_env = {**os.environ, **(env or {})}
    completed = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        env=merged_env,
        shell=True,
        text=True,
        input=stdin_text,
    )
    return completed.returncode


def require(command: str, *, cwd: Path | None = None, env: dict | None = None, stdin_text: str | None = None) -> None:
    code = run(command, cwd=cwd, env=env, stdin_text=stdin_text)
    if code != 0:
        fail(f"command failed (exit {code}): {command}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Set up and launch Juste Recrute Moi locally.")
    parser.add_argument("--no-run", action="store_true", help="set everything up but do not launch the app")
    parser.add_argument("--force", action="store_true", help="re-fetch the runtime assets (model) even if present")
    args = parser.parse_args()

    print(_c("Juste Recrute Moi local startup", "1"))
    print(f"  repo: {ROOT}")

    # 1) prerequisites
    step("Checking prerequisites")
    missing = [tool for tool in ("uv", "pnpm") if shutil.which(tool) is None]
    if missing:
        fail(f"missing required tools on PATH: {', '.join(missing)}. Install them, then re-run.")
    ok("uv + pnpm found")

    # 2) backend deps (idempotent — uv sync is a no-op when the venv matches the lock)
    step("Backend Python deps (uv sync)")
    require("uv sync", cwd=BACKEND)
    ok("backend venv matches the lockfile")

    # 3) frontend deps
    step("Frontend deps (pnpm install)")
    if args.force or not (ROOT / "node_modules").exists():
        require("pnpm install", cwd=ROOT)
        ok("node_modules installed")
    else:
        ok("node_modules already present (use --force to refresh)")

    # 4) ONNX embedding model -> the dev sidecar's app-data dir
    step("Semantic embedding model (ONNX all-MiniLM-L6-v2)")
    data_dir = app_data_dir()
    download_code = (
        "import json\n"
        "from data.vector.embeddings import download_onnx_model\n"
        f"result = download_onnx_model(force={bool(args.force)})\n"
        "print('  model:', json.dumps(result))\n"
        "import sys; sys.exit(0 if result.get('status') in ('ok', 'exists') else 1)\n"
    )
    require("uv run python -", cwd=BACKEND, env={"JHM_APP_DATA_DIR": str(data_dir)}, stdin_text=download_code)
    ok(f"model in place under {data_dir / 'models'}")

    # 5) Playwright Chromium (browser_runtime falls back to the default cache in dev)
    step("Browser runtime (Playwright Chromium)")
    require("uv run python -m playwright install chromium", cwd=BACKEND)
    ok("Chromium ready")

    if args.no_run:
        print("\n" + _c("[ok] Local environment ready.", "1;32"))
        print("  Launch any time with:  python startup.py   (or  pnpm dev:local)")
        return

    # 6) launch the full app (frontend + Rust shell + Python sidecar)
    step("Launching Juste Recrute Moi  (pnpm tauri dev)")
    print("  (Ctrl-C to stop. The app window will open once the Rust shell builds.)")
    sys.exit(run("pnpm tauri dev", cwd=ROOT))


if __name__ == "__main__":
    main()
