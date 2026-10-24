import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWalletEligibility } from "../src/lib/wallet-eligibility";
import { methodKey, normalizeMethods, type PaymentMethod } from "../src/lib/business-tools";

const wallet = (currency: string, balance: number | null, id = 1): PaymentMethod => ({
  id: 12,
  name: `${currency} wallet`,
  type: "BALANCE",
  fiatWalletId: id,
  currency,
  balance,
  walletEnabled: true,
});
const context = {
  action: "BUSINESS_TOOLS_ACCESS",
  amount: 0,
  currency: "USD",
  feeMode: "EXCLUSIVE" as const,
};

test("wallet eligibility compares fee-inclusive quotes in each wallet currency, including exact coverage", async () => {
  const wallets = [wallet("USD", 25), wallet("EUR", 23.5, 2), wallet("CDF", 70_000, 3)];
  const original = structuredClone(wallets);
  const calls: URL[] = [];
  const results = await checkWalletEligibility(
    wallets,
    context,
    async (path) => {
      const url = new URL(path, "https://portal.test");
      calls.push(url);
      const currency = url.searchParams.get("paymentCurrency")!;
      return {
        fees: currency === "CDF" ? 1400 : 0.5,
        feesCurrency: currency,
        totalToPay: currency === "USD" ? 25.5 : currency === "EUR" ? 23.5 : 71_400,
        totalToPayCurrency: currency,
        appliedFeeApplicationMode: "EXCLUSIVE",
      };
    },
    new AbortController().signal,
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["insufficient", "eligible", "insufficient"],
  );
  assert.deepEqual(
    results.map((result) => result.key),
    wallets.map(methodKey),
  );
  for (const call of calls) {
    assert.equal(call.pathname, "/customer-api/fees");
    assert.equal(call.searchParams.get("action"), "BUSINESS_TOOLS_ACCESS");
    assert.equal(call.searchParams.get("amount"), "0");
    assert.equal(call.searchParams.get("currency"), "USD");
    assert.equal(call.searchParams.get("feeApplicationMode"), "EXCLUSIVE");
    assert.ok(call.searchParams.get("fiatWalletId"));
  }
  assert.deepEqual(wallets, original);
});

test("empty, disabled, generic and unknown-balance wallets cannot become selectable and do not request quotes", async () => {
  let reads = 0;
  const methods: PaymentMethod[] = [
    wallet("USD", 0),
    { ...wallet("USD", 100), walletEnabled: false },
    { ...wallet("USD", 100), fiatWalletId: null },
    wallet("USD", null),
    wallet("USD", NaN),
    { id: 8, name: "USDT", type: "CRYPTO" },
  ];
  const results = await checkWalletEligibility(
    methods,
    context,
    async () => {
      reads++;
      throw new Error("No quote should be requested");
    },
    new AbortController().signal,
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["insufficient", "ineligible", "ineligible", "unavailable", "unavailable"],
  );
  assert.equal(reads, 0);
  assert.deepEqual(
    await checkWalletEligibility(
      [],
      context,
      async () => {
        throw new Error("Unexpected read");
      },
      new AbortController().signal,
    ),
    [],
  );
});

test("quote failure, malformed amounts and mismatched currency are unavailable rather than insufficient funds", async () => {
  const results = await checkWalletEligibility(
    [wallet("USD", 100, 1), wallet("USD", 100, 2), wallet("USD", 100, 3)],
    context,
    async (path) => {
      const id = new URL(path, "https://portal.test").searchParams.get("fiatWalletId");
      if (id === "1") throw new Error("Offline");
      return {
        fees: 0,
        feesCurrency: "USD",
        totalToPay: id === "2" ? 0 : 25,
        totalToPayCurrency: id === "3" ? "EUR" : "USD",
      };
    },
    new AbortController().signal,
  );
  assert.deepEqual(
    results.map((result) => result.status),
    ["unavailable", "unavailable", "unavailable"],
  );
});

test("wallet checks limit concurrent reads and discard results on cancellation", async () => {
  let active = 0,
    maximum = 0;
  const methods = Array.from({ length: 8 }, (_, index) => wallet("USD", 100, index + 1));
  const results = await checkWalletEligibility(
    methods,
    context,
    async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return { fees: 0, feesCurrency: "USD", totalToPay: 25, totalToPayCurrency: "USD" };
    },
    new AbortController().signal,
  );
  assert.equal(maximum, 3);
  assert.ok(results.every((result) => result.status === "eligible"));
  const abort = new AbortController();
  let calls = 0;
  await assert.rejects(
    checkWalletEligibility(
      methods,
      context,
      async () => {
        calls++;
        abort.abort();
        return { fees: 0, feesCurrency: "USD", totalToPay: 25, totalToPayCurrency: "USD" };
      },
      abort.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});

test("payment discovery preserves backend provider logos and wallet identity", () => {
  const methods = [
    wallet("USD", 100),
    { id: 2, name: "Tether", type: "CRYPTO", logoUrl: "https://media.example/usdt.png" },
    {
      id: 3,
      name: "M-Pesa",
      type: "MOBILE_MONEY",
      currency: "KES",
      logoUrl: "https://media.example/mpesa.png",
    },
  ];
  const parsed = normalizeMethods({ paymentMethods: methods });
  assert.equal(parsed.paymentMethods[1].logoUrl, methods[1].logoUrl);
  assert.equal(parsed.paymentMethods[2].logoUrl, methods[2].logoUrl);
  assert.equal(parsed.paymentMethods[0].fiatWalletId, 1);
});
