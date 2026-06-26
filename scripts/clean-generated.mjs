import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const includeDeps = args.has("--include-deps");

const keepNames = new Set([".gitkeep"]);
const skippedDirs = new Set([
  ".git",
  ".codex",
  ".claude",
  "node_modules",
  "backend/.venv",
  "src-tauri/target",
]);

const removed = [];
const plannedPaths = [];
let reclaimedBytes = 0;

function usage() {
  console.log(`Usage: node scripts/clean-generated.mjs [--dry-run] [--include-deps]

Removes generated and disposable project artifacts.

Options:
  --dry-run       Print what would be removed without deleting anything.
  --include-deps  Also remove dependency installs (node_modules, backend/.venv).
`);
}

if (args.has("--help") || args.has("-h")) {
  usage();
  process.exit(0);
}

function repoPath(relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  const fromRoot = relative(repoRoot, absolutePath);
  if (fromRoot.startsWith("..") || (fromRoot === "" && relativePath !== ".")) {
    throw new Error(`Refusing to clean outside the repo: ${relativePath}`);
  }
  return absolutePath;
}

function repoRelative(path) {
  return relative(repoRoot, path).split(sep).join("/");
}

function isSameOrInside(path, parent) {
  const fromParent = relative(parent, path);
  return fromParent === "" || (!fromParent.startsWith("..") && !isAbsolute(fromParent));
}

function isInsidePlannedPath(path) {
  return plannedPaths.some((plannedPath) => isSameOrInside(path, plannedPath));
}

function bytes(path) {
  if (!existsSync(path)) return 0;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  return readdirSync(path).reduce((total, entry) => total + bytes(join(path, entry)), 0);
}

function formatBytes(value) {
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function removeAbsolutePath(path, reason) {
  if (!existsSync(path)) return;
  if (isInsidePlannedPath(path)) return;
  const size = bytes(path);
  const displayPath = repoRelative(path);
  removed.push({ path: displayPath, reason, size });
  plannedPaths.push(path);
  reclaimedBytes += size;
  if (!dryRun) {
    rmSync(path, { recursive: true, force: true });
  }
}

function removePath(relativePath, reason) {
  removeAbsolutePath(repoPath(relativePath), reason);
}

function cleanContents(relativePath, reason) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path)) {
    if (keepNames.has(entry)) continue;
    removeAbsolutePath(join(path, entry), reason);
  }
}

function removeEntriesMatching(relativePath, predicate, reason) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) return;
  for (const entry of readdirSync(path)) {
    if (predicate(entry)) {
      removeAbsolutePath(join(path, entry), reason);
    }
  }
}

function shouldSkipWalk(path) {
  if (isInsidePlannedPath(path)) return true;
  const rel = repoRelative(path);
  return skippedDirs.has(rel) || (!includeDeps && (rel === "node_modules" || rel === "backend/.venv"));
}

function walkGeneratedFiles(path = repoRoot) {
  if (!existsSync(path) || shouldSkipWalk(path)) return;
  const entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.name === ".DS_Store") {
      removeAbsolutePath(child, "macOS metadata");
      continue;
    }
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") {
        removeAbsolutePath(child, "Python bytecode cache");
        continue;
      }
      walkGeneratedFiles(child);
      continue;
    }
    if (entry.name.endsWith(".pyc") || entry.name.endsWith(".pyo")) {
      removeAbsolutePath(child, "Python bytecode");
    }
  }
}

const fixedTargets = [
  ["dist", "Vite build output"],
  ["dist-ssr", "SSR build output"],
  ["coverage", "coverage output"],
  ["htmlcov", "Python coverage output"],
  ["website/dist", "website build output"],
  ["graphify-out", "local analysis output"],
  [".coverage", "coverage data"],
  ["backend/.coverage", "backend coverage data"],
  ["backend/htmlcov", "backend coverage output"],
  [".pytest_cache", "pytest cache"],
  ["backend/.pytest_cache", "backend pytest cache"],
  [".mypy_cache", "mypy cache"],
  ["backend/.mypy_cache", "backend mypy cache"],
  [".ruff_cache", "ruff cache"],
  ["backend/.ruff_cache", "backend ruff cache"],
  [".uv-cache", "uv cache"],
  ["backend/.uv-cache", "backend uv cache"],
  ["backend/.hf-cache", "Hugging Face cache"],
  ["backend/.pyinstaller-cache", "PyInstaller cache"],
  ["backend/build_cache", "PyInstaller work cache"],
  ["backend/.pytest-basetemp", "pytest temp base"],
  ["backend/tests/.scratch-templates", "test scratch templates"],
  [".codex-temp-appdata", "local dev app-data scratch"],
  [".codex-temp-sidecar", "sidecar build scratch"],
  [".codex-temp-vector-runtime", "vector runtime build scratch"],
  [".codex-temp-runtime-pack", "runtime pack build scratch"],
  [".codex-video-analysis", "local video analysis output"],
  ["release-assets", "release artifacts"],
  ["test_resume_output.pdf", "generated test document"],
  ["profile_export.json", "generated profile export"],
  ["src-tauri/target", "Rust/Tauri build output"],
  ["src-tauri/gen/schemas", "Tauri generated schemas"],
  ["src-tauri/WixTools", "Windows installer tools cache"],
  ["src-tauri/resources/backend", "generated sidecar resource"],
  ["src-tauri/resources/sidecar-internal", "generated sidecar internals"],
  ["src-tauri/resources/runtime-pack", "staged runtime pack"],
  ["src-tauri/resources/bin/ms-playwright", "bundled Playwright runtime"],
];

for (const [target, reason] of fixedTargets) {
  removePath(target, reason);
}

cleanContents("src-tauri/resources/python-runtime", "staged Python runtime");
cleanContents("src-tauri/resources/bin/chromium", "bundled Chromium runtime");

removeEntriesMatching(".", (name) => name.startsWith(".codex-temp-"), "Codex scratch directory");
removeEntriesMatching(".", (name) => name.startsWith("release-assets-"), "release artifacts");
removeEntriesMatching(".", (name) => name.endsWith(".log") || name.startsWith("npm-debug.log"), "log file");
removeEntriesMatching("backend/tests", (name) => name.startsWith("tmp"), "backend test scratch");
removeEntriesMatching("src-tauri/resources", (name) => name.startsWith("backend-"), "generated sidecar resource");

if (includeDeps) {
  removePath("node_modules", "Node dependency install");
  removePath("backend/.venv", "Python dependency install");
}

walkGeneratedFiles();

if (removed.length === 0) {
  console.log(dryRun ? "[clean-generated] Nothing would be removed." : "[clean-generated] Nothing to remove.");
  process.exit(0);
}

const action = dryRun ? "Would remove" : "Removed";
console.log(`[clean-generated] ${action} ${removed.length} item(s), ${formatBytes(reclaimedBytes)} total:`);
for (const item of removed.sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`- ${item.path} (${formatBytes(item.size)}) - ${item.reason}`);
}
