import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GITHUB_PAT_STORAGE_KEY } from "../api";
import { loadCachedRegistryPack } from "../githubRegistryCache";
import type { Registry } from "../types";

function loadToken(): string {
  try {
    return localStorage.getItem(GITHUB_PAT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function GitHubRepoOverview() {
  const { owner = "", repo = "" } = useParams();
  const [pack, setPack] = useState<{
    registry: Registry | null;
    defaultBranch: string;
    htmlUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owner || !repo) return;
      const token = loadToken().trim();
      if (!token) {
        setPack(null);
        setError(
          "No GitHub token in this browser. Go to All projects and run import."
        );
        setLoading(false);
        return;
      }
      setPack(null);
      setError(null);
      setLoading(true);
      try {
        const data = await loadCachedRegistryPack(owner, repo, token);
        if (!cancelled) setPack(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, repo]);

  if (!owner || !repo) {
    return <p className="lead">Missing repository in URL.</p>;
  }

  if (error) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
        </p>
        <div className="message error">{error}</div>
      </>
    );
  }

  if (loading || (!pack && !error)) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
        </p>
        <p className="lead">Loading repository…</p>
      </>
    );
  }

  if (!pack) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
        </p>
        <p className="lead">Could not load repository.</p>
      </>
    );
  }

  const { registry, defaultBranch, htmlUrl } = pack;

  if (!registry) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
        </p>
        <h1 className="page-title">
          {owner}/{repo}
        </h1>
        <p className="lead">
          No <code className="mono">data/registry.json</code> found on branch{" "}
          <code className="mono">{defaultBranch}</code>. Add that file in the
          repository to see progress here.
        </p>
        <p className="small">
          <a href={htmlUrl} target="_blank" rel="noreferrer">
            Open on GitHub
          </a>
        </p>
      </>
    );
  }

  const done = registry.progress.milestones.filter((m) => m.done).length;
  const total = registry.progress.milestones.length;

  return (
    <>
      <p className="small registry-back">
        <Link to="/">All projects</Link>
        {" · "}
        <a href={htmlUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </p>
      <h1 className="page-title">{registry.appName}</h1>
      <p className="lead">{registry.progress.summary}</p>
      <p className="small">
        Repository <span className="mono">{owner}/{repo}</span>, default branch{" "}
        <span className="mono">{defaultBranch}</span> (read-only from GitHub).
      </p>

      <div className="grid cols-3">
        <div className="stat">
          <div className="label">Phase</div>
          <div className="value">{registry.progress.phase}</div>
        </div>
        <div className="stat">
          <div className="label">Completion (estimate)</div>
          <div className="value">{registry.progress.percentComplete}%</div>
        </div>
        <div className="stat">
          <div className="label">Tracked files</div>
          <div className="value">{registry.files.length}</div>
        </div>
      </div>

      <Link
        className="primary-link"
        to={`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files`}
      >
        Open file-level detail
      </Link>

      <div className="card card-spaced">
        <h2>Milestones</h2>
        <ul className="milestones">
          {registry.progress.milestones.map((m) => (
            <li key={m.name}>
              <span className={`pill ${m.done ? "done" : ""}`}>
                {m.done ? "Done" : "Open"}
              </span>
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
        <p className="small">
          Progress: {done} of {total} milestones marked complete.
        </p>
      </div>
    </>
  );
}
