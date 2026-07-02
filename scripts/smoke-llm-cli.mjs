// Opt-in live smoke for the keyless subscription CLIs (claude_cli / codex_cli).
//
// Makes REAL calls to the locally-installed `claude` / `codex` CLIs through the
// backend LLM client (call_raw + structured call_llm). Requires a logged-in
// subscription; per-provider it self-skips if the CLI isn't on PATH. CI never
// runs this (it sets no subscription and doesn't invoke this script).
//
//   pnpm smoke:llm-cli
//
// Sets JHM_LIVE_CLI=1 cross-platform (so it works the same on Windows, macOS,
// and Linux — unlike an inline `VAR=1` prefix, which cmd.exe doesn't support).

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDir = join(repoRoot, "backend");

const child = spawn(
  "uv",
  ["run", "python", "-m", "pytest", "tests/test_llm_cli_live.py", "-v"],
  {
    cwd: backendDir,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, JHM_LIVE_CLI: "1" },
  },
);

child.on("error", (error) => {
  console.error(`Failed to launch live-CLI smoke: ${error.message}`);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 1));
