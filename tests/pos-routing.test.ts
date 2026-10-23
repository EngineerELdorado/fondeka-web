import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PosStoresClient,
  normalizePosStores,
  posDestination,
  resolvePosDestination,
  posStoresPath,
} from "../src/lib/pos-stores";
import { businessDestination, type BusinessToolsAccess } from "../src/lib/business-tools";
import { BusinessToolsClient, mayMountOwnerData } from "../src/lib/business-tools-client";
import { invalidateQueryPaths, clearQueryCache } from "../src/lib/query-cache";
import { canUseStore } from "../src/lib/commerce";
import type { Store } from "../src/lib/types";

const store: Store = {
  id: 42,
  name: "My store",
  slug: "my-store",
  defaultCurrency: "CDF",
  status: "ACTIVE",
  accessType: "OWNER",
};
const page = (content: Store[], total = content.length) => ({
  content,
  totalElements: total,
  totalPages: Math.ceil(total / 20),
  number: 0,
  size: 20,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
const tick = () => new Promise<void>((done) => setImmediate(done));

test("POS chooses zero, one or multiple stores before navigating and respects backend totals", () => {
  assert.equal(posDestination(normalizePosStores(page([]))), "/stores?mode=pos&state=empty");
  assert.equal(posDestination(normalizePosStores(page([store]))), "/stores/42/pos");
  assert.equal(posDestination(normalizePosStores(page([store], 43))), "/stores?mode=pos");
  assert.equal(posDestination(normalizePosStores([store])), "/stores/42/pos");
  assert.equal(posDestination(normalizePosStores([])), "/stores?mode=pos&state=empty");
});

test("POS cannot infer a count or construct a destination from malformed IDs or a failed response", () => {
  for (const value of [
    null,
    {},
    { content: [] },
    { content: [store] },
    page([], 1),
    page([store], 0),
    page([{ ...store, id: 0 }]),
    page([{ ...store, id: Number.MAX_SAFE_INTEGER + 1 }]),
    page([{ ...store, id: "other" } as unknown as Store]),
    { ...page([store]), totalElements: "1" },
  ])
    assert.throws(() => normalizePosStores(value), /Unable to load/);
  assert.throws(() => posDestination(page([{ ...store, id: -1 }])), /Unable to load/);
});

test("preload, rapid POS clicks and the chooser coalesce into one localized read", async () => {
  const response = deferred<unknown>();
  let reads = 0;
  const client = new PosStoresClient(async (path, init) => {
    reads++;
    assert.equal(path, posStoresPath());
    assert.deepEqual(init.headers, { "Accept-Language": "fr" });
    assert.equal(init.method, undefined);
    return response.promise;
  });
  try {
    const preload = client.load(0, "fr");
    assert.equal(client.load(0, "fr"), preload);
    const first = resolvePosDestination(client, "fr", () => true);
    const second = resolvePosDestination(client, "fr", () => true);
    await tick();
    assert.equal(reads, 1);
    response.resolve(page([store]));
    assert.deepEqual(await Promise.all([first, second]), ["/stores/42/pos", "/stores/42/pos"]);
    assert.equal((await client.load(0, "fr")).content[0].id, 42);
    assert.equal(reads, 1);
  } finally {
    client.dispose();
  }
});

test("browser Back reuses loaded stores; stale reads and explicit refresh preserve the previous list", async () => {
  let now = 1000;
  let reads = 0;
  const client = new PosStoresClient(
    async () => {
      reads++;
      return page([store]);
    },
    () => now,
  );
  try {
    await client.load();
    await resolvePosDestination(client, "en", () => true);
    assert.equal(reads, 1);
    now += 120_001;
    assert.equal(client.page().data?.totalElements, 1);
    await client.load();
    assert.equal(reads, 2);
    client.invalidate();
    assert.equal(client.page().data?.content[0].id, 42);
    assert.equal(client.fresh(), false);
    await client.load();
    assert.equal(reads, 3);
  } finally {
    client.dispose();
  }
});

test("store create/delete invalidation refreshes the POS count and unrelated queries leave it intact", async () => {
  let total = 0;
  let reads = 0;
  const client = new PosStoresClient(async () => {
    reads++;
    return page(total ? [store] : []);
  });
  try {
    assert.equal(
      await resolvePosDestination(client, "en", () => true),
      "/stores?mode=pos&state=empty",
    );
    invalidateQueryPaths(["/customer-api/transactions"]);
    await client.load();
    assert.equal(reads, 1);
    total = 1;
    invalidateQueryPaths(["/customer-api/commerce/stores?"]);
    assert.equal(await resolvePosDestination(client, "en", () => true), "/stores/42/pos");
    total = 0;
    invalidateQueryPaths(["/customer-api/commerce/stores"]);
    assert.equal(
      await resolvePosDestination(client, "en", () => true),
      "/stores?mode=pos&state=empty",
    );
    clearQueryCache();
    assert.equal(client.fresh(), false);
    assert.equal(reads, 3);
  } finally {
    client.dispose();
  }
});

test("failed store resolution remains an error, with no guessed empty state; retry is an explicit read", async () => {
  let failing = true;
  let reads = 0;
  const client = new PosStoresClient(async () => {
    reads++;
    if (failing) throw new Error("Service unavailable");
    return page([store]);
  });
  try {
    await assert.rejects(
      resolvePosDestination(client, "en", () => true),
      /Service unavailable/,
    );
    assert.equal(client.page().data, undefined);
    assert.equal(client.page().error?.message, "Service unavailable");
    assert.equal(reads, 1);
    failing = false;
    assert.equal(await resolvePosDestination(client, "en", () => true), "/stores/42/pos");
    assert.equal(reads, 2);
  } finally {
    client.dispose();
  }
});

test("access denial never fetches stores, and a later authoritative grant continues the original POS decision", async () => {
  let granted = false;
  let accessReads = 0;
  let storeReads = 0;
  const access = (): BusinessToolsAccess => ({
    accessGranted: granted,
    status: granted ? "ACTIVE" : "INACTIVE",
    validFrom: null,
    validUntil: null,
    plan: {
      code: "BUSINESS",
      name: "Business Tools",
      billingMode: "ONE_TIME",
      amount: 10,
      currency: "USD",
      purchasesEnabled: true,
      version: 1,
    },
    pendingPurchase: null,
    pricing: { planAmount: 10, legacyCreditAmount: 0, amountDue: 10, currency: "USD" },
  });
  const tools = new BusinessToolsClient({
    accountKey: "A",
    request: async () => {
      accessReads++;
      return access();
    },
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    onGranted: () => {},
  });
  const stores = new PosStoresClient(async () => {
    storeReads++;
    return page([store]);
  });
  const allowed = async () => {
    await tools.ensureAccess();
    return mayMountOwnerData(tools.getSnapshot(), "/pos", true);
  };
  try {
    await tools.enter("/pos");
    assert.equal(await resolvePosDestination(stores, "en", allowed), undefined);
    assert.equal(storeReads, 0);
    granted = true;
    await tools.reload();
    assert.equal(tools.getSnapshot().destination, "/pos");
    assert.equal(await resolvePosDestination(stores, "en", allowed), "/stores/42/pos");
    assert.equal(storeReads, 1);
    assert.equal(accessReads, 2); // Reusing access at navigation introduces no additional access GET.
  } finally {
    stores.dispose();
    tools.dispose();
  }
});

test("revocation or another selection while stores load prevents late navigation", async () => {
  let allowed = true;
  const response = deferred<unknown>();
  const client = new PosStoresClient(() => response.promise);
  try {
    const target = resolvePosDestination(client, "en", () => allowed);
    await tick();
    allowed = false;
    response.resolve(page([store]));
    assert.equal(await target, undefined);
  } finally {
    client.dispose();
  }
});

test("account switch and invalidation reject an older read even when the transport ignores abort", async () => {
  for (const dispose of [true, false]) {
    const response = deferred<unknown>();
    const client = new PosStoresClient(() => response.promise);
    const pending = client.load();
    await tick();
    if (dispose) client.dispose();
    else client.invalidate();
    response.resolve(page([store]));
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(client.page().data, undefined);
    client.dispose();
  }
  const other = new PosStoresClient(async () => page([]));
  try {
    assert.equal((await other.load()).totalElements, 0);
  } finally {
    other.dispose();
  }
});

test("POS pagination keeps backend totals and store permission filtering does not alter the routing count", async () => {
  const restricted = { ...store, accessType: "STAFF", staffPermissions: ["products"] };
  const client = new PosStoresClient(async (path) => {
    assert.equal(path, posStoresPath(1));
    return { ...page([restricted], 21), number: 1, totalPages: 2 };
  });
  try {
    const result = await client.load(1);
    assert.equal(result.number, 1);
    assert.equal(result.totalElements, 21);
    assert.equal(result.content.filter((s) => canUseStore(s, "POS")).length, 0);
    assert.equal(posDestination(result), "/stores?mode=pos");
    assert.equal(canUseStore({ ...restricted, staffPermissions: ["pos"] }, "POS"), true);
  } finally {
    client.dispose();
  }
});

test("POS URLs retain only known internal store, chooser and creation selections", () => {
  assert.equal(
    businessDestination("/stores/42/pos?flow=sale&step=payment&returnTo=https://foreign.example"),
    "/stores/42/pos?flow=sale&step=payment",
  );
  assert.equal(
    businessDestination("/stores?mode=pos&state=empty&new=1&returnTo=//foreign.example"),
    "/stores?mode=pos&state=empty&new=1",
  );
  assert.equal(businessDestination("/stores?mode=other&state=empty"), "/stores");
  for (const href of [
    "/stores/no/pos",
    "/stores/42/pos/admin",
    "https://foreign.example/stores/42/pos",
    "//foreign.example/pos",
  ])
    assert.equal(businessDestination(href), undefined);
});
