/** Memory-only account cache. Stale reads stay visible while revalidating; never cache secrets or mutations. */
let generation = 0;
export function queryCacheGeneration() {
  return generation;
}
const entries = new Map<string, { data: unknown; time: number; path?: string; version: string }>();
const pending = new Map<
  string,
  {
    version: string;
    path: string;
    controller: AbortController;
    promise: Promise<unknown>;
  }
>();
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
    for (const [key, task] of pending)
      if (matches(task.path, path)) {
        pending.delete(key);
        task.controller.abort();
      }
  }
  for (const listener of listeners) listener();
}
export function cachedQuery<T>(key: string): T | undefined {
  return entries.get(key)?.data as T | undefined;
}
export function isQueryFresh(key: string, version = "", now = Date.now()) {
  const entry = entries.get(key);
  return !!entry && entry.version === version && now - entry.time < 120_000;
}
export function cacheQuery(
  key: string,
  data: unknown,
  now = Date.now(),
  expectedGeneration = generation,
  path?: string,
  version = "",
) {
  if (expectedGeneration !== generation) return;
  if (!entries.has(key) && entries.size >= 200) entries.delete(entries.keys().next().value!);
  entries.set(key, { data, time: now, path, version });
}
/** Concurrent views share one GET; account changes/invalidation abort and discard old responses. */
export function fetchQuery<T>(
  key: string,
  version: string,
  path: string,
  read: (signal: AbortSignal) => Promise<T>,
  force = false,
): Promise<T> {
  if (!force && isQueryFresh(key, version)) return Promise.resolve(cachedQuery<T>(key)!);
  const existing = pending.get(key);
  if (existing?.version === version) return existing.promise as Promise<T>;
  existing?.controller.abort();
  const controller = new AbortController();
  const expectedGeneration = generation;
  const task = {
    version,
    path,
    controller,
    promise: undefined as unknown as Promise<T>,
  };
  task.promise = Promise.resolve().then(async () => {
    if (controller.signal.aborted) throw new DOMException("Query cancelled", "AbortError");
    try {
      const data = await read(controller.signal);
      if (
        pending.get(key) !== task ||
        controller.signal.aborted ||
        generation !== expectedGeneration
      )
        throw new DOMException("Query cancelled", "AbortError");
      cacheQuery(key, data, Date.now(), expectedGeneration, path, version);
      return data;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      // A confirmed permission/not-found/validation error must not leave obsolete owner data visible.
      if (
        pending.get(key) === task &&
        status &&
        status >= 400 &&
        status < 500 &&
        ![408, 429].includes(status)
      )
        entries.delete(key);
      throw error;
    } finally {
      if (pending.get(key) === task) pending.delete(key);
    }
  });
  pending.set(key, task);
  return task.promise;
}
export function clearQueryCache() {
  generation++;
  for (const task of pending.values()) task.controller.abort();
  pending.clear();
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
