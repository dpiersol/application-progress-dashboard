import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GITHUB_PAT_STORAGE_KEY } from "../api";
import { RegistryFileTable } from "../components/RegistryFileTable";
import { loadCachedRegistryPack } from "../githubRegistryCache";
import type { Registry } from "../types";

function loadToken(): string {
  try {
    return localStorage.getItem(GITHUB_PAT_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function GitHubRepoFiles() {
  const { owner = "", repo = "" } = useParams();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!owner || !repo) return;
      setReady(false);
      setError(null);
      setRegistry(null);

      const token = loadToken().trim();
      if (!token) {
        setError(
          "No GitHub token in this browser. Go to All projects and run import."
        );
        setReady(true);
        return;
      }
      try {
        const pack = await loadCachedRegistryPack(owner, repo, token);
        if (!cancelled) setRegistry(pack.registry);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [owner, repo]);

  if (!owner || !repo) {
    return <p className="lead">Missing repository in URL.</p>;
  }

  if (!ready) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
        </p>
        <p className="lead">Loading files…</p>
      </>
    );
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

  if (!registry) {
    return (
      <>
        <p className="small registry-back">
          <Link to="/">All projects</Link>
          {" · "}
          <Link
            to={`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
          >
            Project overview
          </Link>
        </p>
        <h1 className="page-title">Files</h1>
        <p className="lead">
          No registry file in this repository, so there is nothing to list.
        </p>
      </>
    );
  }

  return (
    <>
      <p className="small registry-back">
        <Link to="/">All projects</Link>
        {" · "}
        <Link
          to={`/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`}
        >
          Project overview
        </Link>
      </p>
      <h1 className="page-title">File registry — {registry.appName}</h1>
      <p className="lead">
        Read-only copy from GitHub (<span className="mono">{owner}/{repo}</span>
        ). Edit the registry in the repository (or use the local dashboard under{" "}
        <Link to="/local/files">Local files</Link>) if you need changes committed.
      </p>

      <RegistryFileTable
        files={registry.files}
        readOnly
        emptyHint="No files listed in this registry."
      />
    </>
  );
}
