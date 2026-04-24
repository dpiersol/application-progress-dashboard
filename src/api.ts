import type { FileEntry, GitHubRepoSummary, Registry } from "./types";

const base = "/api";

export const GITHUB_PAT_STORAGE_KEY = "github.pat";

function githubTokenHeaders(token: string): HeadersInit {
  return { "X-GitHub-Token": token };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = `${res.status} ${res.statusText}`;
    try {
      const err = JSON.parse(text) as {
        error?: string;
        message?: string;
      };
      if (typeof err.error === "string" && err.error.trim()) {
        message = err.error.trim();
      } else if (typeof err.message === "string" && err.message.trim()) {
        message = err.message.trim();
      } else if (text.trim() && text.length < 600) {
        message = text.trim();
      }
    } catch {
      if (text.trim()) message = text.trim().slice(0, 600);
    }
    throw new Error(
      `${message} (${res.url || "request"})`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchRegistry(): Promise<Registry> {
  return json<Registry>(await fetch(`${base}/registry`));
}

export async function saveRegistry(body: Registry): Promise<void> {
  await json(await fetch(`${base}/registry`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
}

export async function addFile(entry: {
  path: string;
  purpose: string;
  creatorName: string;
}): Promise<FileEntry> {
  return json<FileEntry>(
    await fetch(`${base}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    })
  );
}

export async function patchFile(
  path: string,
  body: { purpose?: string; modifierName: string }
): Promise<FileEntry> {
  const encoded = encodeURIComponent(path);
  return json<FileEntry>(
    await fetch(`${base}/files/${encoded}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export async function deleteFile(path: string): Promise<void> {
  const encoded = encodeURIComponent(path);
  await json(await fetch(`${base}/files/${encoded}`, { method: "DELETE" }));
}

export async function syncFromGit(repoPath: string, purposeDefault?: string) {
  return json<{
    ok: boolean;
    trackedInGit: number;
    registryRows: number;
    added: number;
    updatedTimestamps: number;
  }>(
    await fetch(`${base}/sync-git`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoPath, purposeDefault }),
    })
  );
}

export async function importAllFromGithub(token: string): Promise<{
  repos: GitHubRepoSummary[];
  registries: Record<string, Registry | null>;
}> {
  return json(
    await fetch(`${base}/github/import`, {
      method: "POST",
      headers: githubTokenHeaders(token),
    })
  );
}

export async function fetchGithubRegistry(
  owner: string,
  repo: string,
  token: string
): Promise<{
  registry: Registry | null;
  defaultBranch: string;
  htmlUrl: string;
}> {
  return json(
    await fetch(
      `${base}/github/registry/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      { headers: githubTokenHeaders(token) }
    )
  );
}
