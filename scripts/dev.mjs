/**
 * Runs the registry API and Vite together with inherited stdio so both stay
 * alive on Windows (avoids flaky concurrently + piped stdin shutdown).
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");

function spawnInherit(command, args) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

const api = spawnInherit(process.execPath, [path.join(root, "server.mjs")]);
const ui = spawnInherit(process.execPath, [viteCli]);

console.log("Starting Vite (UI) and registry API — press Ctrl+C to stop both.");

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    api.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    ui.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(code), 200).unref();
}

api.on("exit", (code, signal) => {
  if (!shuttingDown) {
    shutdown(signal ? 1 : code ?? 0);
  }
});

ui.on("exit", (code, signal) => {
  if (!shuttingDown) {
    shutdown(signal ? 1 : code ?? 0);
  }
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(0));
