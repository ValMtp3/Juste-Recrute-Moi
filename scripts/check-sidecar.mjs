// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Vasudev Siddh and vasu-devs
//
// M5: fail fast if `tauri build` runs without a packaged sidecar binary.
// Tauri's externalBin names the file `jhm-sidecar-next-<target-triple><ext>`,
// produced by `pnpm build:sidecar`. A bundle built without it ships a UI
// with no working backend, so refuse to proceed.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = join(here, "..", "src-tauri", "resources", "backend");
const extension = process.platform === "win32" ? ".exe" : "";
const manifestPath = join(backendDir, "sidecar-manifest.json");
const minSidecarBytes = 1024 * 1024;

function fail(message) {
  console.error(`\n[check-sidecar] ${message}\n`);
  process.exit(1);
}

function rustTriple() {
  const result = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
  if (result.status !== 0) {
    fail(`Could not determine Rust host triple: ${result.stderr || result.stdout || "rustc -vV failed"}`);
  }
  const triple = result.stdout.match(/^host:\s*(.+)$/m)?.[1]?.trim();
  if (!triple) {
    fail("Could not read host triple from rustc -vV output.");
  }
  return triple;
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    fail("Missing src-tauri/resources/backend/sidecar-manifest.json. Run `pnpm build:sidecar` before packaging.");
  }
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`Invalid sidecar manifest JSON: ${error.message}`);
  }
}

const triple = rustTriple();
const expectedBinary = `jhm-sidecar-next-${triple}${extension}`;
const manifest = readManifest();
const sidecarPath = join(backendDir, expectedBinary);

if (manifest.platformTriple !== triple) {
  fail(`Sidecar manifest was built for ${manifest.platformTriple || "unknown"}, but this build target is ${triple}. Run \`pnpm build:sidecar\`.`);
}

if (manifest.sidecarBinary !== expectedBinary) {
  fail(`Sidecar manifest points at ${manifest.sidecarBinary || "missing"}, expected ${expectedBinary}. Run \`pnpm build:sidecar\`.`);
}

if (manifest.sidecarLayout !== "onefile") {
  fail(`Release sidecar must be a PyInstaller onefile build, got ${manifest.sidecarLayout || "missing"}.`);
}

if (!existsSync(sidecarPath)) {
  fail(`No sidecar binary found at src-tauri/resources/backend/${expectedBinary}. Run \`pnpm build:sidecar\`.`);
}

const actualBytes = statSync(sidecarPath).size;
if (actualBytes < minSidecarBytes) {
  fail(`Sidecar binary is only ${actualBytes} bytes, which looks like a placeholder. Run \`pnpm build:sidecar\`.`);
}

if (Number(manifest.sidecarBinaryBytes || 0) !== actualBytes) {
  fail(`Sidecar binary size (${actualBytes}) does not match the manifest (${manifest.sidecarBinaryBytes || "missing"}). Run \`pnpm build:sidecar\`.`);
}

console.log(`[check-sidecar] sidecar binary present: ${expectedBinary} (${actualBytes} bytes).`);
