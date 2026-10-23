import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cachedQuery,
  cacheQuery,
  clearQueryCache,
  fetchQuery,
  invalidateQueryPaths,
  isQueryFresh,
  queryCacheGeneration,
} from "../src/lib/query-cache";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const path = "/customer-api/commerce/stores?page=0&size=20";
const key = `account-a:${path}:en`;

test("idle lists remain readable while concurrent return visits share one background read", async () => {
  clearQueryCache();
  cacheQuery(key, ["old store"], Date.now() - 180_000, queryCacheGeneration(), path, "v1");
  assert.equal(isQueryFresh(key, "v1"), false);
  const next = deferred<string[]>();
  let reads = 0;
  const read = () => {
    reads++;
    return next.promise;
  };
  const first = fetchQuery(key, "v1", path, read);
  assert.equal(fetchQuery(key, "v1", path, read), first);
  await Promise.resolve();
  assert.equal(reads, 1);
  assert.deepEqual(cachedQuery(key), ["old store"]);
  next.resolve(["updated store"]);
  await first;
  assert.deepEqual(cachedQuery(key), ["updated store"]);
  assert.equal(isQueryFresh(key, "v1"), true);
  await fetchQuery(key, "v1", path, read);
  assert.equal(reads, 1);
});

test("explicit refresh supersedes an older read without restoring its stale response", async () => {
  clearQueryCache();
  const old = deferred<string[]>();
  const latest = deferred<string[]>();
  const first = fetchQuery(key, "v1", path, () => old.promise);
  const rejected = assert.rejects(first, { name: "AbortError" });
  await Promise.resolve();
  const second = fetchQuery(key, "v2", path, () => latest.promise);
  latest.resolve(["new version"]);
  await second;
  old.resolve(["old version"]);
  await rejected;
  assert.deepEqual(cachedQuery(key), ["new version"]);
  assert.equal(isQueryFresh(key, "v2"), true);
});
test("manual status polling bypasses fresh data while concurrent polls still share the same GET", async () => {
  clearQueryCache();
  cacheQuery(key, { status: "PROCESSING" }, Date.now(), queryCacheGeneration(), path, "v1");
  const next = deferred<{ status: string }>();
  let reads = 0;
  const read = () => {
    reads++;
    return next.promise;
  };
  const first = fetchQuery(key, "v1", path, read, true);
  assert.equal(fetchQuery(key, "v1", path, read, true), first);
  assert.deepEqual(cachedQuery(key), { status: "PROCESSING" });
  next.resolve({ status: "COMPLETED" });
  await first;
  assert.equal(reads, 1);
  assert.deepEqual(cachedQuery(key), { status: "COMPLETED" });
});

test("logout aborts old reads and a late response cannot populate another account cache", async () => {
  clearQueryCache();
  const old = deferred<string[]>();
  let signal!: AbortSignal;
  const reading = fetchQuery(key, "v1", path, (value) => {
    signal = value;
    return old.promise;
  });
  const rejected = assert.rejects(reading, { name: "AbortError" });
  await Promise.resolve();
  clearQueryCache();
  assert.equal(signal.aborted, true);
  await fetchQuery("account-b:stores:en", "v1", path, async () => ["B only"]);
  old.resolve(["A only"]);
  await rejected;
  assert.equal(cachedQuery(key), undefined);
  assert.deepEqual(cachedQuery("account-b:stores:en"), ["B only"]);
});

test("path invalidation cancels obsolete reads without disturbing unrelated data", async () => {
  clearQueryCache();
  cacheQuery("wallets", ["USD"], Date.now(), queryCacheGeneration(), "/customer-api/fiat-wallets");
  const old = deferred<string[]>();
  const reading = fetchQuery(key, "v1", path, () => old.promise);
  const rejected = assert.rejects(reading, { name: "AbortError" });
  await Promise.resolve();
  invalidateQueryPaths(["/customer-api/commerce/stores"]);
  old.resolve(["deleted store"]);
  await rejected;
  assert.equal(cachedQuery(key), undefined);
  assert.deepEqual(cachedQuery("wallets"), ["USD"]);
});

test("temporary refresh failure retains loaded data; confirmed permission/not-found failures discard it", async () => {
  for (const status of [0, 500, 429, 403, 404]) {
    clearQueryCache();
    cacheQuery(key, ["previous list"], Date.now() - 180_000, queryCacheGeneration(), path, "v1");
    await assert.rejects(
      fetchQuery(key, "v1", path, async () => {
        throw Object.assign(new Error("Cannot refresh"), { status });
      }),
      /Cannot refresh/,
    );
    assert.deepEqual(
      cachedQuery(key),
      status === 403 || status === 404 ? undefined : ["previous list"],
    );
  }
});
