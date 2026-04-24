/**
 * Starts the registry API on a temporary port, runs smoke checks, then stops.
 * Run after `npm run build && npm test` via `npm run verify`.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.VERIFY_API_PORT || "38947";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const proc = spawn("node", ["server.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
proc.stderr.on("data", (c) => {
  stderr += String(c);
});

proc.on("error", (err) => {
  console.error("Failed to spawn server:", err);
  process.exit(1);
});

async function main() {
  let healthy = false;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (r.ok) {
        healthy = true;
        break;
      }
    } catch {
      /* port not open yet */
    }
    await sleep(120);
  }

  if (!healthy) {
    console.error("API health check failed. Server stderr (tail):\n", stderr.slice(-800));
    proc.kill("SIGTERM");
    process.exit(1);
  }

  const noToken = await fetch(`http://127.0.0.1:${port}/api/github/import`, {
    method: "POST",
  });
  if (noToken.status !== 401) {
    console.error(
      "Expected POST /api/github/import without X-GitHub-Token to return 401, got",
      noToken.status
    );
    proc.kill("SIGTERM");
    process.exit(1);
  }

  const reg = await fetch(`http://127.0.0.1:${port}/api/registry`);
  if (!reg.ok) {
    console.error("GET /api/registry failed:", reg.status, await reg.text());
    proc.kill("SIGTERM");
    process.exit(1);
  }

  const body = await reg.json();
  if (!body || typeof body.appName !== "string" || !Array.isArray(body.files)) {
    console.error("GET /api/registry returned unexpected shape");
    proc.kill("SIGTERM");
    process.exit(1);
  }

  console.log("verify-services: OK (API smoke on port", port + ")");
  proc.kill("SIGTERM");
  await sleep(400);
}

main().catch((e) => {
  console.error(e);
  try {
    proc.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  process.exit(1);
});
