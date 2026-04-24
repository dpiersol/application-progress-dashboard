import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addFile,
  deleteFile,
  fetchRegistry,
  patchFile,
  syncFromGit,
} from "../api";
import { formatDate, formatTime } from "../format";
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

  const sortedFiles = useMemo(() => {
    if (!data) return [];
    return [...data.files].sort((a, b) => a.path.localeCompare(b.path));
  }, [data]);

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
      <p className="small" style={{ marginBottom: 8 }}>
        <Link to="/">Back to overview</Link>
      </p>
      <h1 className="page-title">File registry</h1>
      <p className="lead">
        Each row is one tracked file: immutable creation metadata (unless you
        remove the row), and modification fields that update whenever you save an
        edit or run Git sync.
      </p>

      {error ? <div className="message error">{error}</div> : null}
      {syncMessage ? <div className="message">{syncMessage}</div> : null}

      <div className="card">
        <h2>Your identity on this machine</h2>
        <div className="toolbar">
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
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
        <p className="small" style={{ marginTop: 0 }}>
          Runs <code className="mono">git log</code> /{" "}
          <code className="mono">git ls-files</code> in the repo you specify.
          New files get a default purpose you can edit later. Existing rows keep
          their purpose; last-modified is refreshed from Git.
        </p>
        <div className="toolbar">
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
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
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="path">Relative file path</label>
            <input
              id="path"
              className="mono"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="src/app/main.ts"
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
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

      <h2 className="page-title" style={{ fontSize: "1.1rem", marginTop: 28 }}>
        All tracked files
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Purpose</th>
              <th>Created</th>
              <th>Creator</th>
              <th>Modified</th>
              <th>Modifier</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedFiles.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <span className="small">No files yet. Add one or sync from Git.</span>
                </td>
              </tr>
            ) : (
              sortedFiles.map((row) => (
                <tr key={row.path}>
                  <td className="mono">{row.path}</td>
                  <td>
                    <textarea
                      className="mono"
                      style={{
                        width: "100%",
                        minWidth: 180,
                        minHeight: 52,
                        margin: 0,
                      }}
                      value={purposeDrafts[row.path] ?? row.purpose}
                      onChange={(e) =>
                        setPurposeDrafts((d) => ({
                          ...d,
                          [row.path]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div>{formatDate(row.createdAt)}</div>
                    <div className="small">{formatTime(row.createdAt)}</div>
                  </td>
                  <td>{row.createdBy}</td>
                  <td>
                    <div>{formatDate(row.modifiedAt)}</div>
                    <div className="small">{formatTime(row.modifiedAt)}</div>
                  </td>
                  <td>{row.modifiedBy}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleSavePurpose(row)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={busy}
                        onClick={() => handleDelete(row)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
