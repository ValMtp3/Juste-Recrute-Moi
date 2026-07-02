import { spawn } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const commands = [
  ["typecheck", pnpm, ["exec", "tsc", "--noEmit"]],
  ["vite build", pnpm, ["exec", "vite", "build"]],
];

let failed = false;

function run(name, command, args) {
  const child = spawn(command, args, {
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });

  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line) process.stdout.write(`[${name}] ${line}\n`);
      }
    });
  }

  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) failed = true;
      resolve();
    });
  });
}

for (const [name, command, args] of commands) {
  await run(name, command, args);
}
process.exit(failed ? 1 : 0);
