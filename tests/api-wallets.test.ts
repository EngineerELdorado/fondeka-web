import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiWalletsPath,
  parseApiWallets,
  parseSandboxEntries,
  parseSandboxEntry,
  sandboxEntriesPath,
  sandboxFundingBody,
} from "../src/lib/api-wallets";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type { ApiWallet, Page, SandboxWalletEntry } from "../src/lib/types";

export const entry: SandboxWalletEntry = {
  id: "22fc1b16-2415-4402-95f8-1f5c009fbeb8",
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
test("wallet reads carry environment, currency and bounded on-demand history pagination", () => {
  assert.equal(
    apiWalletsPath(42, "LIVE"),
    "/customer-api/businesses/42/api-wallets?environment=LIVE",
  );
  assert.equal(
    apiWalletsPath(42, "SANDBOX", " cdf "),
    "/customer-api/businesses/42/api-wallets?environment=SANDBOX&currency=CDF",
  );
  assert.equal(
    sandboxEntriesPath(42, "usd", 3),
    "/customer-api/businesses/42/sandbox-wallets/USD/entries?page=3&size=20",
  );
  for (const invalid of ["U/S", "USD/entries", "USDT", ""])
    assert.throws(() => sandboxEntriesPath(42, invalid));
});
test("wallet amounts stay fiat units and invalid or mixed-environment responses fail closed", () => {
  assert.deepEqual(parseApiWallets([], "SANDBOX"), []);
  const wallet = { currency: "USD", balance: 100.25, environment: "SANDBOX" };
  assert.equal(parseApiWallets([wallet], "SANDBOX")[0].balance, 100.25);
  assert.throws(() => parseApiWallets([wallet], "LIVE"));
  assert.throws(() => parseApiWallets([wallet], "SANDBOX", "CDF"));
  assert.throws(() => parseApiWallets([wallet, wallet], "SANDBOX"));
  for (const balance of ["100", null, -1, Infinity])
    assert.throws(() => parseApiWallets([{ ...wallet, balance }], "SANDBOX"));
});
test("sandbox ledger retains signed movements, initiating Business and original balance snapshots", () => {
  const debit = {
    ...entry,
    kind: "PAYOUT_DEBIT",
    amount: -10.3,
    balanceAfter: 89.7,
    businessId: 99,
    paymentReference: "SBX012345",
  };
  const refund = { ...entry, kind: "PAYOUT_REFUND", amount: 10.3, balanceAfter: 100, sequence: 2 };
  const history = {
    content: [refund, debit],
    totalElements: 2,
    totalPages: 1,
    number: 0,
    size: 20,
  };
  assert.equal(parseSandboxEntries(history, "USD").content[1].amount, -10.3);
  assert.equal(parseSandboxEntry(debit).businessId, 99);
  assert.equal(parseSandboxEntry(refund).balanceAfter, 100);
  assert.throws(() => parseSandboxEntries(history, "CDF"));
  assert.throws(() => parseSandboxEntry({ ...entry, environment: "LIVE" }));
  assert.throws(() => parseSandboxEntry({ ...debit, paymentReference: "TX123" }));
  assert.throws(() => parseSandboxEntries({ ...history, number: -1 }, "USD"));
});
test("test funding validates normal units, two-decimal precision and the server per-call cap", () => {
  assert.deepEqual(sandboxFundingBody(" cdf ", "100.25"), { currency: "CDF", amount: 100.25 });
  assert.equal(sandboxFundingBody("USD", "1000000.00").amount, 1_000_000);
  for (const amount of ["0", "-1", "1.001", "1000000.01", "1e3", "1,000", "Infinity", "NaN"])
    assert.throws(() => sandboxFundingBody("USD", amount));
});
test("demo test funding is account/currency scoped, idempotent and never changes LIVE balances", async () => {
  resetDemo();
  const path = "/customer-api/businesses/1/sandbox-wallets/top-ups";
  const live = await demoRequest<ApiWallet[]>(apiWalletsPath(1, "LIVE"));
  assert.deepEqual(await demoRequest(apiWalletsPath(1, "SANDBOX")), []);
  assert.deepEqual(await demoRequest(apiWalletsPath(1, "SANDBOX", "USD")), [
    { currency: "USD", balance: 0, environment: "SANDBOX" },
  ]);
  assert.deepEqual(await demoRequest(apiWalletsPath(1, "SANDBOX")), []);
  const post = (amount: number, key: string, businessId = 1, currency = "USD") =>
    demoRequest<SandboxWalletEntry>(path.replace("/1/", `/${businessId}/`), {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ amount, currency }),
    });
  const original = await post(100.25, "fund-001");
  await post(20, "fund-002");
  assert.deepEqual(await post(100.25, "fund-001", 2), original);
  await assert.rejects(post(110, "fund-001"), /conflicts/);
  assert.equal((await post(7, "fund-001", 1, "CDF")).balanceAfter, 7);
  const balances = await demoRequest<ApiWallet[]>(apiWalletsPath(2, "SANDBOX"));
  assert.equal(balances.find((wallet) => wallet.currency === "USD")?.balance, 120.25);
  assert.equal(balances.find((wallet) => wallet.currency === "CDF")?.balance, 7);
  const ledger = await demoRequest<Page<SandboxWalletEntry>>(sandboxEntriesPath(2, "USD"));
  assert.deepEqual(
    ledger.content.map((item) => item.sequence),
    [2, 1],
  );
  assert.equal(ledger.totalElements, 2);
  assert.deepEqual(await demoRequest(apiWalletsPath(1, "LIVE")), live);
});
