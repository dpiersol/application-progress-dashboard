import type { FileEntry } from "./types";

export type SortKey = "file" | "created" | "creator" | "modified" | "modifier";

export function compareIso(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

export function sortFiles(
  files: FileEntry[],
  key: SortKey,
  dir: "asc" | "desc"
): FileEntry[] {
  const mul = dir === "asc" ? 1 : -1;

  return [...files].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "file":
        cmp = a.path.localeCompare(b.path, undefined, { sensitivity: "base" });
        break;
      case "created":
        cmp = compareIso(a.createdAt, b.createdAt);
        break;
      case "creator":
        cmp = a.createdBy.localeCompare(b.createdBy, undefined, {
          sensitivity: "base",
        });
        break;
      case "modified":
        cmp = compareIso(a.modifiedAt, b.modifiedAt);
        break;
      case "modifier":
        cmp = a.modifiedBy.localeCompare(b.modifiedBy, undefined, {
          sensitivity: "base",
        });
        break;
      default:
        cmp = 0;
    }
    if (cmp !== 0) return cmp * mul;
    return a.path.localeCompare(b.path) * mul;
  });
}
