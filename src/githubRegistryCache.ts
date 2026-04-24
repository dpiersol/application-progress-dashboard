import { fetchGithubRegistry } from "./api";
import type { Registry } from "./types";

export type RegistryPack = {
  registry: Registry | null;
  defaultBranch: string;
  htmlUrl: string;
};

const cache = new Map<string, { at: number; data: RegistryPack }>();
const TTL_MS = 60_000;

function cacheKey(owner: string, repo: string) {
  return `${owner}/${repo}`.toLowerCase();
}

export async function loadCachedRegistryPack(
  owner: string,
  repo: string,
  token: string
): Promise<RegistryPack> {
  const k = cacheKey(owner, repo);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fetchGithubRegistry(owner, repo, token);
  cache.set(k, { at: Date.now(), data });
  return data;
}

export function invalidateGithubRegistryCache() {
  cache.clear();
}
