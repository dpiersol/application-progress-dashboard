import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  GITHUB_PAT_STORAGE_KEY,
  importAllFromGithub,
} from "../api";
import { invalidateGithubRegistryCache } from "../githubRegistryCache";
import type { GitHubRepoSummary, Registry } from "../types";

function loadToken(): string {
  try {
    return localStorage.getItem(GITHUB_PAT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(value: string) {
  try {
    if (value.trim()) localStorage.setItem(GITHUB_PAT_STORAGE_KEY, value.trim());
    else localStorage.removeItem(GITHUB_PAT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function repoPath(fullName: string) {
  const i = fullName.indexOf("/");
  const owner = fullName.slice(0, i);
  const repo = fullName.slice(i + 1);
  return `/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function milestoneDoneCount(reg: Registry | null): { done: number; total: number } {
  if (!reg) return { done: 0, total: 0 };
  const ms = reg.progress.milestones || [];
  const done = ms.filter((m) => m.done).length;
  return { done, total: ms.length };
}

export function GitHubProjects() {
  const [token, setToken] = useState(loadToken);
  const [tokenDraft, setTokenDraft] = useState(loadToken);
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [registries, setRegistries] = useState<Record<string, Registry | null>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(null);
  const [apiHealth, setApiHealth] = useState<"checking" | "ok" | "bad">(
    "checking"
  );

  useEffect(() => {
    saveToken(token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/health");
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && body && body.ok === true) setApiHealth("ok");
        else setApiHealth("bad");
      } catch {
        if (!cancelled) setApiHealth("bad");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runImport() {
    const t = tokenDraft.trim();
    if (!t) {
      setError("Paste a GitHub personal access token first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await importAllFromGithub(t);
      setToken(t);
      setTokenDraft(t);
      setRepos(result.repos);
      setRegistries(result.registries);
      invalidateGithubRegistryCache();
      setLastImportedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="page-title">All GitHub projects</h1>
      <p className="lead">
        Imports every repository you can access, then reads{" "}
        <code className="mono">data/registry.json</code> on the default branch
        when that file exists. Progress shown below comes from that file. Open a
        project for overview and file-level drill-down.
      </p>

      {apiHealth === "checking" ? (
        <p className="small">Checking local registry API…</p>
      ) : null}
      {apiHealth === "bad" ? (
        <div className="message error">
          The registry API is not reachable at <code className="mono">/api</code>
          . Run <code className="mono">npm run dev</code> from this project (it
          starts Vite and the registry API together). If you only run{" "}
          <code className="mono">vite</code>, start the API with{" "}
          <code className="mono">npm start</code> (default port{" "}
          <code className="mono">38471</code>) so the Vite proxy can forward{" "}
          <code className="mono">/api</code> correctly.
        </div>
      ) : null}

      <div className="card">
        <h2>GitHub access</h2>
        <p className="small card-lead-tight">
          Create a fine-scoped PAT with at least <strong>Contents: Read</strong>{" "}
          (and <strong>Metadata</strong>). For private repositories, include{" "}
          <strong>repo</strong> scope. The token is stored in this browser only
          and is sent to your local API, which calls GitHub — it is not logged on
          the server disk.
        </p>
        <div className="toolbar">
          <div className="field registry-field-wide">
            <label htmlFor="gh-pat">Personal access token</label>
            <input
              id="gh-pat"
              type="password"
              autoComplete="off"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="ghp_… or github_pat_…"
              className="mono"
            />
          </div>
          <button
            type="button"
            className="primary"
            disabled={loading}
            onClick={() => void runImport()}
          >
            {loading ? "Importing…" : "Save & import all from GitHub"}
          </button>
        </div>
        {lastImportedAt ? (
          <p className="small registry-search-meta">
            Last import finished at{" "}
            {new Date(lastImportedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            . Repos loaded: {repos.length}.
          </p>
        ) : null}
      </div>

      {error ? <div className="message error">{error}</div> : null}

      {repos.length === 0 && !loading && lastImportedAt === null ? (
        <p className="small">
          No data yet. Paste a token and run <strong>Save & import all from GitHub</strong>.
        </p>
      ) : null}

      {repos.length > 0 ? (
        <div className="project-grid">
          {repos.map((r) => {
            const reg = registries[r.fullName] ?? null;
            const { done, total } = milestoneDoneCount(reg);
            const title = reg?.appName ?? r.name;
            const phase = reg?.progress.phase ?? "—";
            const pct = reg?.progress.percentComplete ?? null;
            const files = reg?.files?.length ?? 0;
            return (
              <article key={r.fullName} className="project-card">
                <div className="project-card-head">
                  <h3 className="project-card-title">{title}</h3>
                  <span className="mono project-card-repo">{r.fullName}</span>
                </div>
                {r.description ? (
                  <p className="small project-card-desc">{r.description}</p>
                ) : null}
                {!reg ? (
                  <p className="small project-card-missing">
                    No <code className="mono">data/registry.json</code> on default
                    branch — progress unknown.
                  </p>
                ) : (
                  <div className="project-card-stats">
                    <div>
                      <span className="small">Phase</span>
                      <div className="project-card-value">{phase}</div>
                    </div>
                    <div>
                      <span className="small">Completion</span>
                      <div className="project-card-value">{pct}%</div>
                    </div>
                    <div>
                      <span className="small">Files tracked</span>
                      <div className="project-card-value">{files}</div>
                    </div>
                    <div>
                      <span className="small">Milestones</span>
                      <div className="project-card-value">
                        {total ? `${done} / ${total}` : "—"}
                      </div>
                    </div>
                  </div>
                )}
                <div className="project-card-actions">
                  <Link className="primary-link project-card-link" to={repoPath(r.fullName)}>
                    Open detail
                  </Link>
                  <a
                    className="small"
                    href={r.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on GitHub
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
