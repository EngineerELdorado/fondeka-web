/** Short-lived, memory-only account cache. Never cache credential issuance or mutation responses. */
let generation = 0;
export function queryCacheGeneration() {
  return generation;
}
const entries = new Map<string, { data: unknown; time: number; path?: string }>();
function matches(path: string | undefined | null, prefix: string) {
  return (
    !!path &&
    (path === prefix ||
      path.startsWith(prefix + "?") ||
      path.startsWith(prefix + "/") ||
      ((prefix.endsWith("?") || prefix.endsWith("/")) && path.startsWith(prefix)))
  );
}
const revisions = new Map<string, number>();
const listeners = new Set<() => void>();
let revision = 0;
export function subscribeQueries(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function queryRevision(path: string | null) {
  let current = 0;
  for (const [prefix, value] of revisions)
    if (matches(path, prefix)) current = Math.max(current, value);
  return generation + ":" + current;
}
export function invalidateQueryPaths(paths: string[]) {
  for (const path of paths) {
    revisions.set(path, ++revision);
    for (const [key, entry] of entries) if (matches(entry.path, path)) entries.delete(key);
  }
  for (const listener of listeners) listener();
}
export function cachedQuery<T>(key: string, now = Date.now()): T | undefined {
  const entry = entries.get(key);
  if (!entry || now - entry.time > 120_000) {
    entries.delete(key);
    return;
  }
  return entry.data as T;
}
export function cacheQuery(
  key: string,
  data: unknown,
  now = Date.now(),
  expectedGeneration = generation,
  path?: string,
) {
  if (expectedGeneration !== generation) return;
  if (entries.size >= 200) entries.delete(entries.keys().next().value!);
  entries.set(key, { data, time: now, path });
}
export function clearQueryCache() {
  generation++;
  entries.clear();
  revisions.clear();
  for (const listener of listeners) listener();
}
export function clearCollectionRecovery(keepAccount?: string) {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (
        key.startsWith("fondeka-collection:") &&
        (!keepAccount || !key.startsWith(`fondeka-collection:${keepAccount}:`))
      )
        sessionStorage.removeItem(key);
  } catch {
    /* Logout stays available when storage is blocked. */
  }
}
