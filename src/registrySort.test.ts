import { describe, expect, it } from "vitest";
import { compareIso, sortFiles } from "./registrySort";
import type { FileEntry } from "./types";

function entry(p: Partial<FileEntry> & Pick<FileEntry, "path">): FileEntry {
  return {
    purpose: "p",
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: "a",
    modifiedAt: "2026-01-02T00:00:00.000Z",
    modifiedBy: "b",
    ...p,
  };
}

describe("compareIso", () => {
  it("orders earlier dates before later", () => {
    expect(
      compareIso("2026-01-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z")
    ).toBeLessThan(0);
  });
});

describe("sortFiles", () => {
  const files: FileEntry[] = [
    entry({ path: "z.ts", createdBy: "Zoe" }),
    entry({ path: "a.ts", createdBy: "Amy" }),
    entry({ path: "m.ts", createdBy: "Ben" }),
  ];

  it("sorts by file path ascending", () => {
    const s = sortFiles(files, "file", "asc");
    expect(s.map((f) => f.path)).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("sorts by file path descending", () => {
    const s = sortFiles(files, "file", "desc");
    expect(s.map((f) => f.path)).toEqual(["z.ts", "m.ts", "a.ts"]);
  });

  it("sorts by creator ascending", () => {
    const s = sortFiles(files, "creator", "asc");
    expect(s.map((f) => f.createdBy)).toEqual(["Amy", "Ben", "Zoe"]);
  });
});
