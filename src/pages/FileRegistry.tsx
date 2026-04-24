import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addFile,
  deleteFile,
  fetchRegistry,
  patchFile,
  syncFromGit,
} from "../api";
import { RegistryFileTable } from "../components/RegistryFileTable";
import type { FileEntry, Registry } from "../types";

const NAME_KEY = "tracker.displayName";
const REPO_KEY = "tracker.repoPath";

function loadStored(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function FileRegistry() {
  const [data, setData] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(() => loadStored(NAME_KEY));
  const [repoPath, setRepoPath] = useState(() => loadStored(REPO_KEY));
  const [newPath, setNewPath] = useState("");
  const [newPurpose, setNewPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [purposeDrafts, setPurposeDrafts] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    store(NAME_KEY, displayName);
  }, [displayName]);

  useEffect(() => {
    store(REPO_KEY, repoPath);
  }, [repoPath]);

  async function reload() {
    setError(null);
    const r = await fetchRegistry();
    setData(r);
    const drafts: Record<string, string> = {};
    for (const f of r.files) drafts[f.path] = f.purpose;
    setPurposeDrafts(drafts);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    if (!displayName.trim()) {
      setError("Set your name before adding or editing rows.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addFile({
        path: newPath.trim(),
        purpose: newPurpose.trim() || "—",
        creatorName: displayName.trim(),
      });
      setNewPath("");
      setNewPurpose("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSavePurpose(row: FileEntry) {
    if (!displayName.trim()) {
      setError("Set your name before saving changes.");
      return;
    }
    const purpose = purposeDrafts[row.path] ?? row.purpose;
    setBusy(true);
    setError(null);
    try {
      await patchFile(row.path, {
        purpose,
        modifierName: displayName.trim(),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: FileEntry) {
    if (!confirm(`Remove registry row for ${row.path}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFile(row.path);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGitSync() {
    if (!repoPath.trim()) {
      setError("Enter the absolute path to a Git repository.");
      return;
    }
    setBusy(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await syncFromGit(repoPath.trim());
      setSyncMessage(
        `Synced: ${result.added} new file rows, ${result.updatedTimestamps} modification timestamps refreshed (${result.trackedInGit} paths in Git, ${result.registryRows} rows in registry).`
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <>
        <h1 className="page-title">File registry</h1>
        <p className="lead">
          {error ? (
            <span className="message error">{error}</span>
          ) : (
            "Loading…"
          )}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="small registry-back">
        <Link to="/local">Back to local overview</Link>
      </p>
      <h1 className="page-title">File registry (local)</h1>
      <p className="lead">
        This page edits the registry file on this machine. For GitHub-hosted
        projects, use <Link to="/">All projects</Link> and open a repository
        there.
      </p>

      {error ? <div className="message error">{error}</div> : null}
      {syncMessage ? <div className="message">{syncMessage}</div> : null}

      <div className="card">
        <h2>Your identity on this machine</h2>
        <div className="toolbar">
          <div className="field registry-field-wide">
            <label htmlFor="who">Creator / modifier name</label>
            <input
              id="who"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex Chen"
            />
          </div>
        </div>
        <p className="small">
          Stored locally as <code className="mono">{NAME_KEY}</code>. Used when
          you add a file or save a purpose change.
        </p>
      </div>

      <div className="card">
        <h2>Import paths from Git (optional)</h2>
        <p className="small card-lead-tight">
          Runs <code className="mono">git log</code> /{" "}
          <code className="mono">git ls-files</code> in the repo you specify.
          New files get a default purpose you can edit later. Existing rows keep
          their purpose; last-modified is refreshed from Git.
        </p>
        <div className="toolbar">
          <div className="field registry-field-repo">
            <label htmlFor="repo">Git repository path (absolute)</label>
            <input
              id="repo"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              placeholder="C:\path\to\your\repo"
              className="mono"
            />
          </div>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={handleGitSync}
          >
            Sync from Git
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Register a file manually</h2>
        <div className="toolbar">
          <div className="field registry-field-flex">
            <label htmlFor="path">Relative file path</label>
            <input
              id="path"
              className="mono"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="src/app/main.ts"
            />
          </div>
          <div className="field registry-field-flex">
            <label htmlFor="purpose">Purpose (short)</label>
            <input
              id="purpose"
              value={newPurpose}
              onChange={(e) => setNewPurpose(e.target.value)}
              placeholder="HTTP API bootstrap"
            />
          </div>
          <button
            type="button"
            className="primary"
            disabled={busy || !newPath.trim()}
            onClick={handleAdd}
          >
            Add file
          </button>
        </div>
      </div>

      <RegistryFileTable
        files={data.files}
        readOnly={false}
        busy={busy}
        purposeDrafts={purposeDrafts}
        onPurposeDraftChange={(path, value) =>
          setPurposeDrafts((d) => ({ ...d, [path]: value }))
        }
        onSaveRow={handleSavePurpose}
        onDeleteRow={handleDelete}
        emptyHint="No files yet. Add one or sync from Git."
      />
    </>
  );
}
