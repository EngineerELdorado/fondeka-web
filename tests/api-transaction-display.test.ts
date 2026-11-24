import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiReceiptFields,
  apiTransactionContext,
  apiTransactionKind,
} from "../src/lib/api-transaction-display";
import { emptyFilters, portalQuery } from "../src/lib/portal-query";
import { businessDestination } from "../src/lib/business-tools";
import { demoRequest } from "../src/lib/demo";
import type { ApiEnvironment, ApiTransaction, Page } from "../src/lib/types";

const row: ApiTransaction = {
  requestId: 1,
  apiKeyId: 2,
  apiKeyName: "Checkout",
  createdAt: "2026-11-23T10:00:00Z",
  updatedAt: "2026-11-23T10:00:00Z",
  transaction: {
    environment: "SANDBOX",
    service: "BUSINESS_API",
    action: "BUSINESS_API_BILL_PAYMENT",
    fondekaReference: "opaque",
    amount: 10,
    grossAmount: 10.3,
    fee: 0.3,
    currency: "USD",
    status: "COMPLETED",
  },
};
test("bills and unknown actions never fall through to Collection", () => {
  assert.equal(apiTransactionKind("BUSINESS_API_BILL_PAYMENT"), "Bill payment");
  assert.equal(apiTransactionKind("BUSINESS_API_COLLECTION"), "Collection");
  assert.equal(apiTransactionKind("BUSINESS_API_PAYOUT"), "Payout");
  assert.equal(apiTransactionKind("FUTURE_ACTION"), "Other transaction");
  assert.equal(apiTransactionContext(row).account, undefined);
});
test("context uses bill account and operation without confusing wallet funding or payment destinations", () => {
  const details = {
    billProductCode: "CANAL_PLUS_DRC",
    billProductName: "Canal+ DRC",
    accountNumber: "001234",
    operation: "TV_RENEW",
    paymentMethodName: "FONDEKA_BALANCE",
    accountRef: "wrong-context",
  };
  assert.deepEqual(apiTransactionContext({ ...row, details }), {
    title: "Canal+ DRC",
    accountLabel: "Bill account",
    account: "001234",
    operation: "Subscription renewal",
  });
  assert.equal(
    apiTransactionContext({ ...row, details: { billCategory: "WATER" } }).title,
    "Water",
  );
  assert.equal(
    apiTransactionContext({
      ...row,
      transaction: { ...row.transaction, action: "UNKNOWN" },
      details,
    }).title,
    undefined,
  );
});
test("payment context keeps crypto networks and recipient addresses separate from collection deposit addresses", () => {
  const cryptoDetails = { cryptoCurrency: "USDT", network: "TRC20", address: "deposit-address" };
  const collection = {
    ...row,
    transaction: { ...row.transaction, action: "BUSINESS_API_COLLECTION", cryptoDetails },
  };
  assert.equal(apiTransactionContext(collection).title, "USDT · TRC20");
  assert.equal(apiTransactionContext(collection).account, undefined);
  const payout = {
    ...collection,
    transaction: { ...collection.transaction, action: "BUSINESS_API_PAYOUT" },
  };
  assert.equal(apiTransactionContext(payout).account, "deposit-address");
  assert.equal(
    apiTransactionContext({
      ...payout,
      details: { accountRef: "recipient", paymentMethodDisplayName: "USDT" },
    }).account,
    "recipient",
  );
});
test("receipt display is allowlisted, literal, and preserves tokens, zeros and subscription dates", () => {
  const fields = apiReceiptFields({
    tokens: ["0000-1234", "<script>literal</script>"],
    units: 0,
    valueReceived: "15 kWh",
    receiptNumber: "R-1",
    providerReference: "P-1",
    providerResponse: { secret: "hidden" },
    fxMarginAmount: 50,
    newSubscription: {
      subscriptionNumber: "00123",
      name: "Monthly package",
      expiresAt: "2026-12-23T00:00:00Z",
      price: 0,
      currency: "USD",
      internalCost: 99,
    },
  });
  assert.equal(fields.find((field) => field.label === "Token")?.value, "0000-1234");
  assert.equal(fields.find((field) => field.label === "Units")?.value, "0");
  assert.equal(fields.find((field) => field.label === "Package price")?.value, "0");
  assert.ok(fields.some((field) => field.value === "<script>literal</script>"));
  assert.ok(fields.some((field) => field.format === "date"));
  assert.doesNotMatch(JSON.stringify(fields), /secret|hidden|internalCost|fxMarginAmount/);
});
test("malformed or absent optional receipt fields do not crash or become invented values", () => {
  assert.deepEqual(apiReceiptFields(undefined), []);
  assert.deepEqual(
    apiReceiptFields({
      tokens: [1, {}, null],
      valueReceived: { secret: "hidden" },
      units: NaN,
      newSubscription: { expiresAt: "bad-date", price: Infinity, currency: "USD" },
    }),
    [],
  );
});
test("server bill filters and activation links preserve all other query semantics", () => {
  const params = new URLSearchParams(
    portalQuery(
      {
        ...emptyFilters,
        action: "BUSINESS_API_BILL_PAYMENT",
        status: "COMPLETED",
        currency: "usd",
      },
      2,
      "SANDBOX",
    ),
  );
  assert.equal(params.get("action"), "BUSINESS_API_BILL_PAYMENT");
  assert.equal(params.get("page"), "2");
  assert.equal(params.get("status"), "COMPLETED");
  assert.throws(() => portalQuery({ ...emptyFilters, action: "UNKNOWN" }, 0));
  const link = businessDestination(
    "/developers/transactions?api_action=BUSINESS_API_BILL_PAYMENT&environment=SANDBOX",
  )!;
  assert.match(link, /api_action=BUSINESS_API_BILL_PAYMENT/);
});
test("demo mixed history filters before pagination and receipt data is fetched only with the scoped detail", async () => {
  for (const environment of ["SANDBOX", "LIVE"] as ApiEnvironment[]) {
    const path = "/customer-api/businesses/1/api-transactions";
    const all = await demoRequest<Page<ApiTransaction>>(
      `${path}?environment=${environment}&size=100`,
    );
    assert.ok(all.content.some((row) => row.transaction.action === "BUSINESS_API_BILL_PAYMENT"));
    assert.ok(all.content.every((row) => !Object.hasOwn(row, "receipt")));
    const filtered = await demoRequest<Page<ApiTransaction>>(
      `${path}?${portalQuery({ ...emptyFilters, action: "BUSINESS_API_BILL_PAYMENT", status: "COMPLETED" }, 0, environment)}`,
    );
    assert.ok(filtered.totalElements > 0);
    assert.ok(
      filtered.content.every(
        (row) =>
          row.transaction.action === "BUSINESS_API_BILL_PAYMENT" &&
          row.transaction.status === "COMPLETED",
      ),
    );
    const detail = await demoRequest<ApiTransaction>(
      `${path}/${filtered.content[0].transaction.fondekaReference}?environment=${environment}`,
    );
    assert.ok(apiReceiptFields(detail.receipt).length > 0);
    assert.deepEqual(detail.details, filtered.content[0].details);
  }
});
