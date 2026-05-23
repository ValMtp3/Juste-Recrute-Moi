// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Vasudev Siddh and vasu-devs
//
// M5: fail fast if `tauri build` runs without a packaged sidecar binary.
// Tauri's externalBin names the file `jhm-sidecar-next-<target-triple><ext>`,
// produced by `npm run build:sidecar`. A bundle built without it ships a UI
// with no working backend, so refuse to proceed.

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = join(here, "..", "src-tauri", "resources", "backend");
const extension = process.platform === "win32" ? ".exe" : "";

function hasSidecar() {
  if (!existsSync(backendDir)) return false;
  return readdirSync(backendDir).some(
    (name) => name.startsWith("jhm-sidecar-next-") && name.endsWith(extension),
  );
}

if (!hasSidecar()) {
  console.error(
    "\n[check-sidecar] No sidecar binary found in src-tauri/resources/backend/.\n" +
      "Run `npm run build:sidecar` before building the Tauri bundle, or the\n" +
      "installer will ship with no working backend.\n",
  );
  process.exit(1);
}

console.log("[check-sidecar] sidecar binary present — proceeding with build.");
