import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRegistry, saveRegistry } from "../api";
import type { Registry } from "../types";

const DISPLAY_KEY = "tracker.displayName";

export function ProgressOverview() {
  const [data, setData] = useState<Registry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchRegistry();
        if (!cancelled) setData(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next: Registry) {
    setSaving(true);
    setError(null);
    try {
      await saveRegistry(next);
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <>
        <h1 className="page-title">Overview</h1>
        <p className="lead">
          {error ? (
            <span className="message error">{error}</span>
          ) : (
            "Loading registry…"
          )}
        </p>
      </>
    );
  }

  const done = data.progress.milestones.filter((m) => m.done).length;
  const total = data.progress.milestones.length;

  return (
    <>
      <p className="small registry-back">
        <Link to="/">All GitHub projects</Link>
      </p>
      <h1 className="page-title">{data.appName} (local)</h1>
      <p className="lead">{data.progress.summary}</p>

      {error ? <div className="message error">{error}</div> : null}

      <div className="grid cols-3">
        <div className="stat">
          <div className="label">Phase</div>
          <div className="value">{data.progress.phase}</div>
        </div>
        <div className="stat">
          <div className="label">Completion (estimate)</div>
          <div className="value">{data.progress.percentComplete}%</div>
        </div>
        <div className="stat">
          <div className="label">Tracked files</div>
          <div className="value">{data.files.length}</div>
        </div>
      </div>

      <Link className="primary-link" to="/local/files">
        Open file-level detail
      </Link>

      <div className="card" style={{ marginTop: 22 }}>
        <h2>Milestones</h2>
        <ul className="milestones">
          {data.progress.milestones.map((m) => (
            <li key={m.name}>
              <span className={`pill ${m.done ? "done" : ""}`}>
                {m.done ? "Done" : "Open"}
              </span>
              <span>{m.name}</span>
            </li>
          ))}
        </ul>
        <p className="small">Progress: {done} of {total} milestones marked complete.</p>
      </div>

      <div className="card">
        <h2>Edit high-level summary</h2>
        <div className="inline-form">
          <div className="field" style={{ minWidth: "100%" }}>
            <label htmlFor="appName">Application name</label>
            <input
              id="appName"
              value={data.appName}
              onChange={(e) =>
                setData({ ...data, appName: e.target.value })
              }
            />
          </div>
          <div className="field" style={{ minWidth: "100%" }}>
            <label htmlFor="summary">Summary</label>
            <textarea
              id="summary"
              value={data.progress.summary}
              onChange={(e) =>
                setData({
                  ...data,
                  progress: { ...data.progress, summary: e.target.value },
                })
              }
            />
          </div>
          <div className="grid cols-3">
            <div className="field">
              <label htmlFor="phase">Phase</label>
              <input
                id="phase"
                value={data.progress.phase}
                onChange={(e) =>
                  setData({
                    ...data,
                    progress: { ...data.progress, phase: e.target.value },
                  })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="pct">Percent complete</label>
              <input
                id="pct"
                type="number"
                min={0}
                max={100}
                value={data.progress.percentComplete}
                onChange={(e) =>
                  setData({
                    ...data,
                    progress: {
                      ...data.progress,
                      percentComplete: Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
          <button
            type="button"
            className="primary"
            disabled={saving}
            onClick={() => persist(data)}
          >
            {saving ? "Saving…" : "Save overview"}
          </button>
        </div>
      </div>

      <p className="small">
        Your name for edits is stored in this browser as{" "}
        <code className="mono">{DISPLAY_KEY}</code> (set on the File registry
        page).
      </p>
    </>
  );
}
