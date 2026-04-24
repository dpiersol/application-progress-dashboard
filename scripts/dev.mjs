/**
 * Runs the registry API and Vite together with inherited stdio so both stay
 * alive on Windows (avoids flaky concurrently + piped stdin shutdown).
 *
 * Uses REGISTRY_API_PORT / PORT (default 38471) so the proxy target matches
 * this dashboard's API and is unlikely to collide with another app on 3847.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");

const apiPort =
  process.env.REGISTRY_API_PORT || process.env.PORT || "38471";
const sharedEnv = {
  ...process.env,
  PORT: String(apiPort),
  REGISTRY_API_PORT: String(apiPort),
};

function spawnInherit(command, args) {
  return spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: sharedEnv,
  });
}

async function waitForApiHealth() {
  const url = `http://127.0.0.1:${apiPort}/api/health`;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && body.ok === true) return;
      }
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.error(
    `\n[dev] Registry API did not respond at ${url}.\n` +
      `Check that port ${apiPort} is free, or set PORT / REGISTRY_API_PORT.\n`
  );
  process.exit(1);
}

console.log(
  `Starting registry API on port ${apiPort}, then Vite — press Ctrl+C to stop both.`
);

const api = spawnInherit(process.execPath, [path.join(root, "server.mjs")]);

/** @type {import('node:child_process').ChildProcess | null} */
let ui = null;

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
    ui?.kill("SIGTERM");
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

await waitForApiHealth();

ui = spawnInherit(process.execPath, [viteCli]);

ui.on("exit", (code, signal) => {
  if (!shuttingDown) {
    shutdown(signal ? 1 : code ?? 0);
  }
});

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(0));
