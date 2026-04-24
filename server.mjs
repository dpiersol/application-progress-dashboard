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

const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_API_VERSION = "2022-11-28";

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: GITHUB_ACCEPT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": "application-progress-dashboard",
  };
}

function getGithubToken(req) {
  const raw = req.headers["x-github-token"];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function parseLinkNext(linkHeader) {
  if (!linkHeader) return null;
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

async function fetchAllUserRepos(token) {
  const all = [];
  let url =
    "https://api.github.com/user/repos?per_page=100&sort=updated&type=all";
  for (;;) {
    const res = await fetch(url, { headers: githubHeaders(token) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GitHub repos ${res.status}: ${t.slice(0, 800)}`);
    }
    const batch = await res.json();
    all.push(...batch);
    const next = parseLinkNext(res.headers.get("link"));
    if (!next) break;
    url = next;
  }
  return all;
}

function summarizeRepo(r) {
  return {
    fullName: r.full_name,
    name: r.name,
    owner: r.owner.login,
    htmlUrl: r.html_url,
    description: r.description || "",
    updatedAt: r.updated_at,
    pushedAt: r.pushed_at,
    defaultBranch: r.default_branch,
    private: r.private,
    fork: r.fork,
  };
}

function normalizeRegistry(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.appName !== "string") return null;
  if (!obj.progress || typeof obj.progress !== "object") return null;
  if (!Array.isArray(obj.files)) return null;
  const p = obj.progress;
  if (typeof p.phase !== "string") p.phase = "—";
  if (
    typeof p.percentComplete !== "number" ||
    Number.isNaN(p.percentComplete)
  ) {
    p.percentComplete = 0;
  }
  if (typeof p.summary !== "string") p.summary = "";
  if (!Array.isArray(p.milestones)) p.milestones = [];
  return obj;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} defaultBranch
 * @param {string} token
 */
async function fetchRegistryFromGithub(owner, repo, defaultBranch, token) {
  const ref = defaultBranch || "main";
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/data/registry.json?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(token) }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub file ${res.status}: ${t.slice(0, 500)}`);
  }
  const body = await res.json();
  if (!body || body.encoding !== "base64" || typeof body.content !== "string") {
    return null;
  }
  const raw = Buffer.from(body.content.replace(/\n/g, ""), "base64").toString(
    "utf8"
  );
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return normalizeRegistry(parsed);
}

app.post("/api/github/import", async (req, res) => {
  try {
    const token = getGithubToken(req);
    if (!token) {
      res.status(401).json({ error: "Send GitHub PAT in X-GitHub-Token header." });
      return;
    }
    const reposRaw = await fetchAllUserRepos(token);
    const repos = reposRaw.map(summarizeRepo);
    /** @type {Record<string, unknown>} */
    const registries = {};
    const batchSize = 8;
    for (let i = 0; i < reposRaw.length; i += batchSize) {
      const batch = reposRaw.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (r) => {
          const key = r.full_name;
          try {
            registries[key] = await fetchRegistryFromGithub(
              r.owner.login,
              r.name,
              r.default_branch,
              token
            );
          } catch {
            registries[key] = null;
          }
        })
      );
    }
    res.json({ repos, registries });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/github/registry/:owner/:repo", async (req, res) => {
  try {
    const token = getGithubToken(req);
    if (!token) {
      res.status(401).json({ error: "Send GitHub PAT in X-GitHub-Token header." });
      return;
    }
    const owner = req.params.owner;
    const repo = req.params.repo;
    const metaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: githubHeaders(token) }
    );
    if (!metaRes.ok) {
      res
        .status(metaRes.status)
        .json({ error: (await metaRes.text()).slice(0, 800) });
      return;
    }
    const meta = await metaRes.json();
    const registry = await fetchRegistryFromGithub(
      owner,
      repo,
      meta.default_branch,
      token
    );
    res.json({
      registry,
      defaultBranch: meta.default_branch,
      htmlUrl: meta.html_url,
    });
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
