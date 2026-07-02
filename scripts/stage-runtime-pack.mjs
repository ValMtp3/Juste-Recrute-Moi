import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(process.env.JHM_RUNTIME_PACK_SOURCE_DIR || join(repoRoot, "release-assets"));
const targetDir = join(repoRoot, "src-tauri", "resources", "runtime-pack");

function platformName() {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "linux";
}

function runtimePackAssetName() {
  return `Juste-Recrute-Moi-runtime-pack-${platformName()}.zip`;
}

function formatMb(value) {
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fail(message) {
  console.error(`\n[stage-runtime-pack] ${message}\n`);
  process.exit(1);
}

if (!existsSync(sourceDir)) {
  fail(`Runtime pack source directory not found: ${sourceDir}. Run \`pnpm build:runtime-pack\` first or set JHM_RUNTIME_PACK_SOURCE_DIR.`);
}

const assetName = runtimePackAssetName();
const source = join(sourceDir, assetName);

if (!existsSync(source)) {
  const available = readdirSync(sourceDir).filter((name) => name.endsWith(".zip")).sort();
  fail(`Runtime pack asset not found: ${source}. Available zip assets: ${available.join(", ") || "(none)"}`);
}

const bytes = statSync(source).size;
if (bytes <= 0) {
  fail(`Runtime pack asset is empty: ${source}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, assetName));

console.log(`[stage-runtime-pack] staged ${assetName} (${formatMb(bytes)}) from ${sourceDir}.`);
