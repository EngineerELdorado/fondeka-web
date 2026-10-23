import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SandboxConversionClient,
  clearSandboxConversionRecovery,
  conversionInput,
  parseSandboxConversion,
} from "../src/lib/sandbox-conversion";
import { parseSandboxEntries } from "../src/lib/api-wallets";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type { ApiWallet, Page, SandboxConversion, SandboxWalletEntry } from "../src/lib/types";

const body = { sourceCurrency: "USD", targetCurrency: "EUR", amount: 10 };
const quote: SandboxConversion = {
  id: null,
  status: "QUOTED",
  sourceCurrency: "USD",
  targetCurrency: "EUR",
  sourceAmount: 10,
  feeAmount: 0,
  netSourceAmount: 10,
  targetAmount: 9,
  rate: 0.9,
  sourceWallet: { currency: "USD", balance: 100, environment: "SANDBOX" },
  targetWallet: { currency: "EUR", balance: 0, environment: "SANDBOX" },
  createdAt: null,
  environment: "SANDBOX",
};
const completed: SandboxConversion = {
  ...quote,
  id: "22fc1b16-2415-4402-95f8-1f5c009fbeb8",
  status: "COMPLETED",
  createdAt: "2026-10-23T10:00:00Z",
  sourceWallet: { ...quote.sourceWallet, balance: 90 },
  targetWallet: { ...quote.targetWallet, balance: 9 },
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
    length: { get: () => Object.keys(target).length },
  });
  return target as unknown as Storage;
}
function client(
  store: Storage,
  request: <T>(path: string, init: RequestInit) => Promise<T>,
  businessId = 42,
  accountKey = "A",
  onSettled = () => {},
) {
  return new SandboxConversionClient({
    storage: store,
    request,
    businessId,
    accountKey,
    onSettled,
    uuid: () => "uuid-001",
  });
}
test("conversion requests normalize fiat codes and reject identical currencies and invalid amounts", () => {
  assert.deepEqual(conversionInput(" usd ", "eur", "10.00"), body);
  assert.equal(conversionInput("BIF", "USD", "1").sourceCurrency, "BIF"); // Server fixtures decide availability.
  for (const [source, target, amount] of [
    ["usd", "USD", "10"],
    ["USDT", "USD", "10"],
    ["USD", "EUR", "0"],
    ["USD", "EUR", "10.001"],
    ["USD", "EUR", "1000000.01"],
  ])
    assert.throws(() => conversionInput(source, target, amount));
  assert.throws(() => parseSandboxConversion({ ...quote, environment: "LIVE" }, body, "QUOTED"));
  assert.throws(() => parseSandboxConversion(completed, body, "QUOTED"));
  assert.throws(() => parseSandboxConversion({ ...completed, id: null }, body, "COMPLETED"));
  assert.throws(() =>
    parseSandboxConversion(
      { ...quote, targetWallet: { ...quote.targetWallet, currency: "USD" } },
      body,
      "QUOTED",
    ),
  );
});
test("preview is read-only, accepts unfunded balance snapshots, and cannot execute without confirmation", async () => {
  const store = storage();
  const paths: string[] = [];
  const conversion = client(store, async <T>(path: string, init: RequestInit) => {
    paths.push(path);
    assert.equal(new Headers(init.headers).has("Idempotency-Key"), false);
    assert.deepEqual(JSON.parse(String(init.body)), body);
    return { ...quote, sourceWallet: { ...quote.sourceWallet, balance: 0 } } as T;
  });
  await conversion.confirm();
  assert.equal(paths.length, 0);
  await conversion.preview("USD", "EUR", "10");
  assert.match(paths[0], /sandbox-wallets\/convert\/quote$/);
  assert.equal(paths.length, 1);
  assert.equal(store.length, 0);
  assert.equal(conversion.getSnapshot().quote?.targetAmount, 9);
  assert.equal(conversion.getSnapshot().intent, undefined);
});
test("confirmed conversion submits once, saves recovery first and displays repriced execution amounts", async () => {
  const store = storage();
  let finish!: (result: SandboxConversion) => void;
  const pending = new Promise<SandboxConversion>((resolve) => {
    finish = resolve;
  });
  let writes = 0;
  let refreshed = 0;
  const conversion = client(
    store,
    async <T>(path: string, init: RequestInit) => {
      if (path.endsWith("/quote")) return quote as T;
      writes++;
      assert.equal(store.length, 1);
      assert.equal(new Headers(init.headers).get("Idempotency-Key"), "sbc_uuid-001");
      assert.deepEqual(JSON.parse(String(init.body)), body);
      return (await pending) as T;
    },
    42,
    "A",
    () => {
      refreshed++;
    },
  );
  await conversion.preview("USD", "EUR", "10");
  const execution = conversion.confirm();
  await conversion.confirm();
  assert.equal(writes, 1);
  finish({
    ...completed,
    targetAmount: 8.5,
    rate: 0.85,
    targetWallet: { ...completed.targetWallet, balance: 8.5 },
  });
  await execution;
  assert.equal(conversion.getSnapshot().result?.targetAmount, 8.5);
  assert.equal(conversion.getSnapshot().quote, undefined);
  assert.equal(refreshed, 1);
  assert.equal(store.length, 0);
});
test("editing input invalidates the preview and discards stale in-flight quotes", async () => {
  let resolve!: (value: SandboxConversion) => void;
  const pending = new Promise<SandboxConversion>((r) => {
    resolve = r;
  });
  let calls = 0;
  const conversion = client(storage(), async <T>() => {
    calls++;
    return (await pending) as T;
  });
  const preview = conversion.preview("USD", "EUR", "10");
  conversion.edit();
  await conversion.confirm();
  resolve(quote);
  await preview;
  assert.equal(calls, 1);
  assert.equal(conversion.getSnapshot().quote, undefined);
  assert.equal(conversion.getSnapshot().intent, undefined);
});
test("uncertain conversion resumes through another owned Business with the same body and key", async () => {
  const store = storage();
  const first = client(store, async <T>(path: string) => {
    if (path.endsWith("/quote")) return quote as T;
    throw Object.assign(new Error("Timed out"), { status: 0 });
  });
  await first.preview("USD", "EUR", "10");
  await first.confirm();
  first.dispose();
  let calls = 0;
  const resumed = client(
    store,
    async <T>(path: string, init: RequestInit) => {
      calls++;
      assert.match(path, /businesses\/99\/sandbox-wallets\/convert$/);
      assert.deepEqual(JSON.parse(String(init.body)), body);
      assert.equal(new Headers(init.headers).get("Idempotency-Key"), "sbc_uuid-001");
      return completed as T;
    },
    99,
  );
  await resumed.preview("CDF", "GBP", "900");
  assert.equal(calls, 0);
  await resumed.confirm();
  assert.equal(calls, 1);
  assert.equal(resumed.getSnapshot().result?.sourceWallet.balance, 90);
});
test("conflicts and malformed success preserve the original intent, while confirmed rejection requires another preview", async () => {
  for (const failure of [409, 502, "malformed", null]) {
    const store = storage();
    let calls = 0;
    const conversion = client(store, async <T>(path: string) => {
      if (path.endsWith("/quote")) return quote as T;
      calls++;
      if (failure === "malformed") return quote as T;
      if (failure === null) throw null;
      throw Object.assign(new Error("Unconfirmed"), { status: failure });
    });
    await conversion.preview("USD", "EUR", "10");
    await conversion.confirm();
    assert.equal(calls, 1);
    assert.equal(conversion.getSnapshot().intent?.idempotencyKey, "sbc_uuid-001");
    assert.equal(store.length, 1);
  }
  const rejected = client(storage(), async <T>(path: string) => {
    if (path.endsWith("/quote")) return quote as T;
    throw Object.assign(new Error("Insufficient funds"), {
      status: 400,
      code: "INSUFFICIENT_FUNDS",
    });
  });
  await rejected.preview("USD", "EUR", "10");
  await rejected.confirm();
  assert.equal(rejected.getSnapshot().intent, undefined);
  assert.equal(rejected.getSnapshot().quote, undefined);
});
test("account reset clears conversion recovery and ignores late execution results", async () => {
  const store = storage();
  let finish!: (value: SandboxConversion) => void;
  const pending = new Promise<SandboxConversion>((resolve) => {
    finish = resolve;
  });
  let refreshes = 0;
  const conversion = client(
    store,
    async <T>(path: string) => (path.endsWith("/quote") ? (quote as T) : ((await pending) as T)),
    42,
    "A",
    () => {
      refreshes++;
    },
  );
  await conversion.preview("USD", "EUR", "10");
  const execution = conversion.confirm();
  assert.equal(client(store, async <T>() => quote as T, 42, "B").getSnapshot().intent, undefined);
  conversion.dispose();
  clearSandboxConversionRecovery(store, "B");
  finish(completed);
  await execution;
  assert.equal(store.length, 0);
  assert.equal(refreshes, 0);
});
test("demo conversions do not mutate on quote, atomically move test funds and replay original snapshots", async () => {
  resetDemo();
  const root = "/customer-api/businesses/1";
  const live = await demoRequest(`${root}/api-wallets?environment=LIVE`);
  const preview = () =>
    demoRequest<SandboxConversion>(`${root}/sandbox-wallets/convert/quote`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  assert.equal((await preview()).sourceWallet.balance, 0);
  assert.deepEqual(await demoRequest(`${root}/api-wallets?environment=SANDBOX`), []);
  const execute = (businessId = 1, input = body) =>
    demoRequest<SandboxConversion>(
      `/customer-api/businesses/${businessId}/sandbox-wallets/convert`,
      {
        method: "POST",
        headers: { "Idempotency-Key": "conversion-001" },
        body: JSON.stringify(input),
      },
    );
  await assert.rejects(execute(), /Insufficient/);
  assert.deepEqual(await demoRequest(`${root}/api-wallets?environment=SANDBOX`), []);
  await demoRequest(`${root}/sandbox-wallets/top-ups`, {
    method: "POST",
    headers: { "Idempotency-Key": "conversion-001" },
    body: JSON.stringify({ currency: "USD", amount: 100 }),
  });
  assert.equal((await preview()).targetAmount, 9);
  const result = await execute();
  assert.equal(result.sourceWallet.balance, 90);
  assert.equal(result.targetWallet.balance, 9);
  const source = parseSandboxEntries(
    await demoRequest(`${root}/sandbox-wallets/USD/entries`),
    "USD",
  );
  const target = parseSandboxEntries(
    await demoRequest(`${root}/sandbox-wallets/EUR/entries`),
    "EUR",
  );
  assert.equal(source.content[0].kind, "CONVERSION_DEBIT");
  assert.equal(source.content[0].amount, -10);
  assert.equal(target.content[0].kind, "CONVERSION_CREDIT");
  assert.equal(source.content[0].conversionId, result.id);
  assert.equal(target.content[0].conversionId, result.id);
  assert.equal(target.content[0].paymentReference, null);
  await demoRequest(`${root}/sandbox-wallets/top-ups`, {
    method: "POST",
    headers: { "Idempotency-Key": "later-funding" },
    body: JSON.stringify({ currency: "USD", amount: 5 }),
  });
  assert.deepEqual(await execute(2), result);
  await assert.rejects(execute(1, { ...body, targetCurrency: "GBP" }), /conflicts/);
  const balances = await demoRequest<ApiWallet[]>(`${root}/api-wallets?environment=SANDBOX`);
  assert.equal(balances.find((wallet) => wallet.currency === "USD")?.balance, 95);
  assert.equal(balances.find((wallet) => wallet.currency === "EUR")?.balance, 9);
  assert.equal(
    (await demoRequest<Page<SandboxWalletEntry>>(`${root}/sandbox-wallets/EUR/entries`))
      .totalElements,
    1,
  );
  assert.deepEqual(await demoRequest(`${root}/api-wallets?environment=LIVE`), live);
});

test("unavailable recovery storage blocks execution while keeping preview read-only", async () => {
  let writes = 0;
  const conversion = new SandboxConversionClient({
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
    request: async <T>(path: string) => {
      if (!path.endsWith("/quote")) writes++;
      return quote as T;
    },
  });
  await conversion.preview("USD", "EUR", "10");
  assert.equal(conversion.getSnapshot().quote?.targetAmount, 9);
  await conversion.confirm();
  assert.equal(writes, 0);
  assert.equal(conversion.getSnapshot().intent, undefined);
  assert.match(conversion.getSnapshot().error!, /Storage unavailable/);
});
