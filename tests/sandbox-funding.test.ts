import { test } from "node:test";
import assert from "node:assert/strict";
import { SandboxFundingClient, clearSandboxFundingRecovery } from "../src/lib/sandbox-funding";
import type { SandboxWalletEntry } from "../src/lib/types";

const entry: SandboxWalletEntry = {
  id: "top-up",
  currency: "USD",
  kind: "TOP_UP",
  amount: 100,
  balanceAfter: 100,
  businessId: 42,
  paymentReference: null,
  createdAt: "2026-10-23T10:00:00Z",
  environment: "SANDBOX",
  sequence: 1,
};
function storage() {
  const target: Record<string, unknown> = {};
  Object.defineProperties(target, {
    getItem: { value: (key: string) => target[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        target[key] = value;
      },
    },
    removeItem: {
      value: (key: string) => {
        delete target[key];
      },
    },
    clear: {
      value: () => {
        for (const key of Object.keys(target)) delete target[key];
      },
    },
    length: { get: () => Object.keys(target).length },
    key: { value: (index: number) => Object.keys(target)[index] ?? null },
  });
  return target as unknown as Storage;
}
function client(
  store: Storage,
  request: <T>(path: string, init: RequestInit) => Promise<T>,
  accountKey = "A",
  onSettled = () => {},
) {
  return new SandboxFundingClient({
    accountKey,
    businessId: 42,
    storage: store,
    request,
    onSettled,
    uuid: () => "uuid-001",
  });
}
test("double submission sends one request and persists its recovery before sending", async () => {
  const store = storage();
  let calls = 0;
  let finish!: (entry: SandboxWalletEntry) => void;
  const pending = new Promise<SandboxWalletEntry>((resolve) => {
    finish = resolve;
  });
  const funding = client(store, async <T>(path: string, init: RequestInit) => {
    calls++;
    assert.equal(store.length, 1);
    assert.match(path, /businesses\/42\/sandbox-wallets\/top-ups$/);
    assert.equal(new Headers(init.headers).get("Idempotency-Key"), "sbt_uuid-001");
    assert.deepEqual(JSON.parse(String(init.body)), { currency: "USD", amount: 100 });
    return (await pending) as T;
  });
  const first = funding.submit("USD", "100");
  await funding.submit("USD", "100");
  assert.equal(calls, 1);
  finish(entry);
  await first;
  assert.equal(funding.getSnapshot().result?.balanceAfter, 100);
  assert.equal(store.length, 0);
});
test("timeout, remount and changed inputs retry the original key, body and Business without automatic POST", async () => {
  const store = storage();
  let body: string | undefined;
  const first = client(store, async <T>(_path: string, init: RequestInit): Promise<T> => {
    body = String(init.body);
    throw Object.assign(new Error("Connection dropped"), { status: 0 });
  });
  await first.submit("USD", "100");
  assert.equal(first.getSnapshot().intent?.body.amount, 100);
  first.dispose();
  let calls = 0;
  const resumed = new SandboxFundingClient({
    accountKey: "A",
    businessId: 99,
    storage: store,
    onSettled: () => {},
    request: async <T>(path: string, init: RequestInit) => {
      calls++;
      assert.match(path, /businesses\/42\//);
      assert.equal(init.body, body);
      assert.equal(new Headers(init.headers).get("Idempotency-Key"), "sbt_uuid-001");
      return { ...entry, balanceAfter: 100 } as T;
    },
  });
  assert.equal(calls, 0);
  await resumed.submit("CDF", "999");
  assert.equal(calls, 1);
  assert.equal(resumed.getSnapshot().result?.currency, "USD");
});
test("conflicts, rate limits and malformed success retain the intent rather than generating another charge", async () => {
  for (const response of [409, 429, 502, "malformed"]) {
    const store = storage();
    let calls = 0;
    const funding = client(store, async <T>(): Promise<T> => {
      calls++;
      if (response === "malformed") return { ...entry, environment: "LIVE" } as T;
      throw Object.assign(new Error("Rejected"), { status: response });
    });
    await funding.submit("USD", "100");
    assert.equal(funding.getSnapshot().intent?.idempotencyKey, "sbt_uuid-001");
    assert.equal(store.length, 1);
    assert.equal(calls, 1);
    assert.equal(funding.getSnapshot().result, undefined);
  }
});
test("confirmed validation failure permits a corrected new intent, while storage failure sends nothing", async () => {
  const store = storage();
  let calls = 0;
  const funding = client(store, async <T>(): Promise<T> => {
    calls++;
    throw Object.assign(new Error("Unsupported currency"), { status: 400 });
  });
  await funding.submit("USD", "100");
  assert.equal(funding.getSnapshot().intent, undefined);
  assert.equal(store.length, 0);
  const blocked = new SandboxFundingClient({
    accountKey: "A",
    businessId: 42,
    storage: {
      getItem: () => null,
      setItem: () => {
        throw new Error("Storage unavailable");
      },
      removeItem: () => {},
    },
    onSettled: () => {},
    request: async <T>() => {
      calls++;
      return entry as T;
    },
  });
  await blocked.submit("USD", "100");
  assert.equal(calls, 1);
  assert.equal(blocked.getSnapshot().intent, undefined);
});
test("account changes clear recovery and disposed clients ignore late results", async () => {
  const store = storage();
  let finish!: (entry: SandboxWalletEntry) => void;
  const pending = new Promise<SandboxWalletEntry>((resolve) => {
    finish = resolve;
  });
  let refreshed = 0;
  const first = client(
    store,
    async <T>() => (await pending) as T,
    "A",
    () => {
      refreshed++;
    },
  );
  const submission = first.submit("USD", "100");
  assert.equal(client(store, async <T>() => entry as T, "B").getSnapshot().intent, undefined);
  first.dispose();
  clearSandboxFundingRecovery(store, "B");
  finish(entry);
  await submission;
  assert.equal(store.length, 0);
  assert.equal(refreshed, 0);
  assert.equal(first.getSnapshot().result, undefined);
});

test("a later permission or validation rejection does not discard an already uncertain funding intent", async () => {
  const store = storage();
  let status = 0;
  const funding = client(store, async <T>(): Promise<T> => {
    throw Object.assign(new Error("Unconfirmed"), { status });
  });
  await funding.submit("USD", "100");
  for (status of [400, 403, 404]) {
    await funding.submit("CDF", "20");
    assert.equal(funding.getSnapshot().intent?.body.currency, "USD");
    assert.equal(store.length, 1);
  }
});
