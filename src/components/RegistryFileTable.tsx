import { useMemo, useState } from "react";
import { formatDate, formatTime } from "../format";
import type { FileEntry } from "../types";
import { sortFiles, type SortKey } from "../registrySort";

type Props = {
  files: FileEntry[];
  readOnly?: boolean;
  busy?: boolean;
  purposeDrafts?: Record<string, string>;
  onPurposeDraftChange?: (path: string, value: string) => void;
  onSaveRow?: (row: FileEntry) => void;
  onDeleteRow?: (row: FileEntry) => void;
  /** Shown when `files` is empty (local vs remote wording). */
  emptyHint?: string;
};

export function RegistryFileTable({
  files,
  readOnly = false,
  busy = false,
  purposeDrafts = {},
  onPurposeDraftChange,
  onSaveRow,
  onDeleteRow,
  emptyHint = "No files in this registry.",
}: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("file");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function purposeText(f: FileEntry): string {
    return purposeDrafts[f.path] ?? f.purpose;
  }

  const filteredSortedFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...files];
    if (q) {
      list = list.filter((f) => {
        const purpose = purposeText(f).toLowerCase();
        return f.path.toLowerCase().includes(q) || purpose.includes(q);
      });
    }
    return sortFiles(list, sortKey, sortDir);
  }, [files, search, sortKey, sortDir, purposeDrafts]);

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortLabel(key: SortKey, title: string) {
    const active = sortKey === key;
    return (
      <button
        type="button"
        className={`sort-btn${active ? " sort-active" : ""}`}
        onClick={() => handleSortClick(key)}
      >
        {title}
        {active ? (
          <span className="sort-indicator" aria-hidden>
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    );
  }

  const totalFiles = files.length;
  const emptyRegistry = totalFiles === 0;
  const noMatches = !emptyRegistry && filteredSortedFiles.length === 0;

  return (
    <>
      <h2 className="page-title registry-section-title">Tracked files</h2>

      <div className="registry-search">
        <div className="field">
          <label htmlFor="registry-search">Search file path or purpose</label>
          <input
            id="registry-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to filter…"
            autoComplete="off"
          />
        </div>
        {!emptyRegistry ? (
          <p className="small registry-search-meta">
            Showing {filteredSortedFiles.length} of {totalFiles}
            {noMatches ? " — no rows match this search." : null}
          </p>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th scope="col">{sortLabel("file", "File")}</th>
              <th scope="col">{sortLabel("created", "Created")}</th>
              <th scope="col">{sortLabel("creator", "Creator")}</th>
              <th scope="col">{sortLabel("modified", "Modified")}</th>
              <th scope="col">{sortLabel("modifier", "Modifier")}</th>
              {!readOnly ? (
                <th scope="col" className="registry-actions-head">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          {emptyRegistry ? (
            <tbody>
              <tr>
                <td colSpan={readOnly ? 5 : 6}>
                  <span className="small">{emptyHint}</span>
                </td>
              </tr>
            </tbody>
          ) : noMatches ? (
            <tbody>
              <tr>
                <td colSpan={readOnly ? 5 : 6}>
                  <span className="small">No rows match this search.</span>
                </td>
              </tr>
            </tbody>
          ) : (
            filteredSortedFiles.map((row) => (
              <tbody key={row.path} className="registry-entry">
                <tr className="registry-meta-row">
                  <td className="mono">{row.path}</td>
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
                  {!readOnly ? (
                    <td className="registry-actions" rowSpan={2}>
                      <div className="row-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onSaveRow?.(row)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={busy}
                          onClick={() => onDeleteRow?.(row)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
                <tr className="registry-purpose-row">
                  <td colSpan={readOnly ? 5 : 5}>
                    <span className="registry-purpose-label">Purpose</span>
                    {readOnly ? (
                      <div className="mono registry-purpose-readonly">
                        {row.purpose}
                      </div>
                    ) : (
                      <textarea
                        className="mono"
                        aria-label={`Purpose for ${row.path}`}
                        value={purposeDrafts[row.path] ?? row.purpose}
                        onChange={(e) =>
                          onPurposeDraftChange?.(row.path, e.target.value)
                        }
                      />
                    )}
                  </td>
                </tr>
              </tbody>
            ))
          )}
        </table>
      </div>
    </>
  );
}
