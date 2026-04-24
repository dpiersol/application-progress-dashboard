import express from "express";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = join(__dirname, "data", "registry.json");
const PORT = Number(process.env.PORT || 3847);

/** @typedef {{ path: string; purpose: string; createdAt: string; createdBy: string; modifiedAt: string; modifiedBy: string }} FileEntry */

async function loadRegistry() {
  const raw = await readFile(REGISTRY_PATH, "utf8");
  return JSON.parse(raw);
}

async function saveRegistry(data) {
  await writeFile(REGISTRY_PATH, JSON.stringify(data, null, 2), "utf8");
}

function encodePath(p) {
  return encodeURIComponent(p);
}

function decodePath(encoded) {
  return decodeURIComponent(encoded);
}

/**
 * @param {string} repoPath
 * @param {string} filePath
 */
async function gitFirstLast(repoPath, filePath) {
  const opts = { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 };
  const last = await execFileAsync(
    "git",
    ["log", "-1", "--format=%cI|%cn", "--", filePath],
    opts
  ).catch(() => ({ stdout: "" }));

  const first = await execFileAsync(
    "git",
    ["log", "--follow", "--format=%cI|%cn", "--reverse", "--", filePath],
    opts
  ).catch(() => ({ stdout: "" }));

  const lastLine = last.stdout.trim().split("\n").filter(Boolean).pop();
  const firstLine = first.stdout.trim().split("\n").filter(Boolean).shift();

  function parse(line) {
    if (!line) return null;
    const idx = line.indexOf("|");
    if (idx === -1) return null;
    const iso = line.slice(0, idx);
    const name = line.slice(idx + 1);
    return { iso, name };
  }

  const created = parse(firstLine) || parse(lastLine);
  const modified = parse(lastLine) || created;

  return { created, modified };
}

/**
 * @param {string} repoPath
 */
async function gitTrackedFiles(repoPath) {
  const { stdout } = await execFileAsync("git", ["ls-files"], {
    cwd: repoPath,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/registry", async (_req, res) => {
  try {
    const data = await loadRegistry();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put("/api/registry", async (req, res) => {
  try {
    await saveRegistry(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/files", async (req, res) => {
  try {
    const { path: relPath, purpose, creatorName } = req.body || {};
    if (!relPath || typeof relPath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }
    const purposeText =
      typeof purpose === "string" && purpose.trim() ? purpose.trim() : "—";
    const creator =
      typeof creatorName === "string" && creatorName.trim()
        ? creatorName.trim()
        : "Unknown";

    const data = await loadRegistry();
    const norm = relPath.replace(/\\/g, "/");
    if (data.files.some((f) => f.path === norm)) {
      res.status(409).json({ error: "File already registered" });
      return;
    }

    const now = new Date().toISOString();
    /** @type {FileEntry} */
    const entry = {
      path: norm,
      purpose: purposeText,
      createdAt: now,
      createdBy: creator,
      modifiedAt: now,
      modifiedBy: creator,
    };
    data.files.push(entry);
    await saveRegistry(data);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/api/files/:encodedPath", async (req, res) => {
  try {
    const relPath = decodePath(req.params.encodedPath);
    const { purpose, modifierName } = req.body || {};
    const data = await loadRegistry();
    const idx = data.files.findIndex((f) => f.path === relPath);
    if (idx === -1) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const now = new Date().toISOString();
    const modName =
      typeof modifierName === "string" && modifierName.trim()
        ? modifierName.trim()
        : data.files[idx].modifiedBy;

    if (typeof purpose === "string" && purpose.trim()) {
      data.files[idx].purpose = purpose.trim();
    }
    data.files[idx].modifiedAt = now;
    data.files[idx].modifiedBy = modName;

    await saveRegistry(data);
    res.json(data.files[idx]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/files/:encodedPath", async (req, res) => {
  try {
    const relPath = decodePath(req.params.encodedPath);
    const data = await loadRegistry();
    const next = data.files.filter((f) => f.path !== relPath);
    if (next.length === data.files.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    data.files = next;
    await saveRegistry(data);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/sync-git", async (req, res) => {
  try {
    const { repoPath, purposeDefault } = req.body || {};
    if (!repoPath || typeof repoPath !== "string") {
      res.status(400).json({ error: "repoPath is required (absolute path to git repo)" });
      return;
    }
    const defaultPurpose =
      typeof purposeDefault === "string" && purposeDefault.trim()
        ? purposeDefault.trim()
        : "—";

    const tracked = await gitTrackedFiles(repoPath);
    const data = await loadRegistry();
    const byPath = new Map(data.files.map((f) => [f.path, f]));

    let added = 0;
    let updated = 0;

    for (const filePath of tracked) {
      const gl = await gitFirstLast(repoPath, filePath);
      const existing = byPath.get(filePath);

      if (!gl.created || !gl.modified) {
        continue;
      }

      if (!existing) {
        /** @type {FileEntry} */
        const entry = {
          path: filePath,
          purpose: defaultPurpose,
          createdAt: gl.created.iso,
          createdBy: gl.created.name,
          modifiedAt: gl.modified.iso,
          modifiedBy: gl.modified.name,
        };
        data.files.push(entry);
        byPath.set(filePath, entry);
        added += 1;
        continue;
      }

      // Preserve creation metadata; always refresh last modification from Git.
      if (
        existing.modifiedAt !== gl.modified.iso ||
        existing.modifiedBy !== gl.modified.name
      ) {
        existing.modifiedAt = gl.modified.iso;
        existing.modifiedBy = gl.modified.name;
        updated += 1;
      }
    }

    await saveRegistry(data);
    res.json({
      ok: true,
      trackedInGit: tracked.length,
      registryRows: data.files.length,
      added,
      updatedTimestamps: updated,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Registry API listening on http://127.0.0.1:${PORT}`);
});
