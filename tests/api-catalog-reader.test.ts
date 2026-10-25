import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiCatalogReader,
  refreshCatalogOnReturn,
  type CatalogReadScope,
} from "../src/lib/api-catalog-reader";

const scope: CatalogReadScope = {
  accountKey: "alice",
  businessId: 42,
  currency: "USD",
  language: "en",
};
const empty = { paymentMethods: [], cryptoNetworks: [] };

test("an open catalog reuses its read across view changes and refreshes only when requested or its read scope changes", async () => {
  const calls: string[] = [];
  const reader = new ApiCatalogReader(async (path, init) => {
    calls.push(path);
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal);
    assert.equal(new Headers(init.headers).get("X-API-Key"), null);
    return empty;
  });
  const pending = reader.load(scope);
  assert.equal(reader.load({ ...scope }), pending);
  assert.equal(reader.refresh(), pending);
  await pending;
  for (let viewChange = 0; viewChange < 12; viewChange++) await reader.load({ ...scope });
  assert.equal(calls.length, 1);
  assert.equal(reader.snapshot().data, empty);
  await reader.refresh();
  assert.equal(calls.length, 2);
  await reader.load({ ...scope, currency: "eur" });
  assert.equal(calls.at(-1), "/customer-api/businesses/42/api-catalog?currency=EUR");
  await reader.load({ ...scope, businessId: 43 });
  await reader.load({ ...scope, accountKey: "bob" });
  await reader.load({ ...scope, accountKey: "bob", language: "fr" });
  assert.equal(calls.length, 6);
  reader.clear();
  assert.equal(reader.snapshot().data, undefined);
  await reader.refresh();
  assert.equal(calls.length, 6);
  await reader.load(scope);
  assert.equal(calls.length, 7);
});

test("scope changes and closing abort pending reads and discard late private responses", async () => {
  const reads: { signal: AbortSignal; resolve: (value: unknown) => void }[] = [];
  const reader = new ApiCatalogReader(
    (_path, init) =>
      new Promise((resolve) => {
        reads.push({ signal: init.signal as AbortSignal, resolve });
      }),
  );
  const old = reader.load(scope);
  await Promise.resolve();
  const current = reader.load({ ...scope, businessId: 43 });
  await Promise.resolve();
  assert.equal(reads[0].signal.aborted, true);
  const currentData = { ...empty };
  reads[1].resolve(currentData);
  await current;
  reads[0].resolve({ ...empty });
  await old;
  assert.equal(reader.snapshot().data, currentData);
  const closing = reader.refresh();
  await Promise.resolve();
  reader.clear();
  assert.equal(reads[2].signal.aborted, true);
  reads[2].resolve(empty);
  await closing;
  assert.equal(reader.snapshot().data, undefined);
});

test("focus and duplicate visible events do not refresh; a genuine background return refreshes once", () => {
  const document = new (class extends EventTarget {
    visibilityState: DocumentVisibilityState = "visible";
  })();
  let calls = 0;
  const stop = refreshCatalogOnReturn(document, () => calls++);
  for (let interaction = 0; interaction < 10; interaction++) {
    document.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("focusin"));
    document.dispatchEvent(new Event("click"));
    document.dispatchEvent(new Event("visibilitychange"));
  }
  assert.equal(calls, 0);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 0);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  stop();
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
});
