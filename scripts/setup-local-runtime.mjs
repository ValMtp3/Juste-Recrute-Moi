// One-time (idempotent) local dev runtime setup.
//
// `pnpm tauri dev` runs the backend from your venv but does NOT auto-download
// the heavy runtime pack (that only happens on first launch of the *packaged*
// app). So in dev the embedding model is missing (falls back to hashing) and the
// Playwright browser may be absent (portfolio crawl / web scout can't launch).
//
// This script fetches both into the exact locations the dev sidecar reads:
//   1. the ONNX embedding model (all-MiniLM-L6-v2, ~90 MB) -> the Tauri app-data
//      dir's models/ folder (JHM_APP_DATA_DIR = app_data_dir() in dev).
//   2. the Playwright Chromium browser -> the default ms-playwright cache.
//
// Safe to re-run: each step skips work that's already present.
//
//   pnpm setup:local      # run once; then `pnpm tauri dev` has everything
//   pnpm dev:local        # setup + tauri dev in one command

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(repoRoot, "backend");

function tauriIdentifier() {
  const conf = JSON.parse(readFileSync(join(repoRoot, "src-tauri", "tauri.conf.json"), "utf8"));
  return conf.identifier || "com.valentinfiess.justerecrutemoi";
}

// Mirror Tauri's app_data_dir() per-OS so the model lands where the dev sidecar looks.
function appDataDir(identifier) {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), identifier);
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", identifier);
  }
  return join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), identifier);
}

function run(label, cmd, args, extraEnv = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, {
    cwd: backendDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`\n[setup:local] ${label} FAILED (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

// Run a multi-line Python snippet via stdin (`python -`) rather than `-c`, so the
// shell never re-parses semicolons/quotes, and the code runs with backendDir on
// sys.path (cwd) so it can import the backend packages.
function runPython(label, pyCode, extraEnv = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("uv", ["run", "python", "-"], {
    cwd: backendDir,
    input: pyCode,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`\n[setup:local] ${label} FAILED (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

const identifier = tauriIdentifier();
const dataDir = appDataDir(identifier);
console.log(`[setup:local] app-data dir for the dev sidecar: ${dataDir}`);

// 1) ONNX embedding model -> <app-data>/models/all-MiniLM-L6-v2 (skips if present).
runPython(
  "Download ONNX embedding model (semantic search)",
  "import json\nfrom data.vector.embeddings import download_onnx_model\nprint(json.dumps(download_onnx_model()))\n",
  { JHM_APP_DATA_DIR: dataDir },
);

// 2) Playwright Chromium -> default ms-playwright cache (playwright skips if present).
run(
  "Install Playwright Chromium (portfolio crawl / web scout)",
  "uv",
  ["run", "python", "-m", "playwright", "install", "chromium"],
);

console.log("\n[setup:local] Done. `pnpm tauri dev` now has the full runtime — semantic embeddings + browser. No first-run download needed.");
