import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiEnvironment,
  apiKeysPath,
  apiTransactionPath,
  assertKeyEnvironment,
  assertTransactionEnvironment,
  resolveApiEnvironment,
  apiEnvironmentSelection,
} from "../src/lib/api-environment";
import { emptyFilters, portalQuery } from "../src/lib/portal-query";
import { demoRequest } from "../src/lib/demo";
import type { ApiKey, ApiTransaction, Page } from "../src/lib/types";

test("the shared API environment follows valid bookmarks and clears stale detail/create selections on change", () => {
  assert.equal(resolveApiEnvironment("SANDBOX", "LIVE"), "SANDBOX");
  assert.equal(resolveApiEnvironment("LIVE", "SANDBOX"), "LIVE");
  assert.equal(resolveApiEnvironment(null, "SANDBOX"), "SANDBOX");
  assert.equal(resolveApiEnvironment("unknown", "LIVE"), "LIVE");
  const values = new URLSearchParams({
    business: "42",
    environment: "LIVE",
    apiReference: "TX001",
    apiDetailBusiness: "42",
    apiPage: "3",
    createKey: "1",
    flow: "api-key",
    step: "review",
    api_currency: "CDF",
  });
  for (const [key, value] of Object.entries(apiEnvironmentSelection("SANDBOX"))) {
    if (value === null) values.delete(key);
    else values.set(key, value);
  }
  assert.deepEqual(Object.fromEntries(values), {
    business: "42",
    environment: "SANDBOX",
    api_currency: "CDF",
  });
});

test("portal key, list and detail queries carry the selected environment with existing filters", () => {
  assert.equal(apiEnvironment(undefined), "LIVE");
  for (const invalid of [null, "test", "live", 1]) assert.throws(() => apiEnvironment(invalid));
  assert.match(apiKeysPath(42, "SANDBOX"), /api-keys\?environment=SANDBOX$/);
  assert.match(
    apiTransactionPath(42, "SBX001", "SANDBOX"),
    /api-transactions\/SBX001\?environment=SANDBOX$/,
  );
  const query = new URLSearchParams(
    portalQuery(
      {
        ...emptyFilters,
        currency: "usd",
        action: "BUSINESS_API_COLLECTION",
        orderReference: "Order&42",
      },
      3,
      "SANDBOX",
    ),
  );
  assert.equal(query.get("environment"), "SANDBOX");
  assert.equal(query.get("page"), "3");
  assert.equal(query.get("currency"), "USD");
  assert.equal(query.get("action"), "BUSINESS_API_COLLECTION");
  assert.equal(query.get("orderReference"), "Order&42");
  assert.equal(new URLSearchParams(portalQuery(emptyFilters, 0)).get("environment"), "LIVE");
  assert.notEqual(
    apiTransactionPath(42, "TX001", "LIVE"),
    apiTransactionPath(42, "TX001", "SANDBOX"),
  );
});
test("mismatched environments cannot be displayed as selected activity or credentials", () => {
  const live = { id: 8, name: "ERP", keyPrefix: "fdk_biz_prefix", enabled: true, createdAt: "" };
  assert.doesNotThrow(() => assertKeyEnvironment([live], "LIVE"));
  assert.throws(() => assertKeyEnvironment([live], "SANDBOX"));
  assert.throws(() => assertKeyEnvironment([{ ...live, environment: "SANDBOX" }], "SANDBOX"));
  assert.throws(() =>
    assertKeyEnvironment([{ ...live, keyPrefix: "fdk_biz_test_prefix" }], "LIVE"),
  );
  assert.doesNotThrow(() =>
    assertKeyEnvironment(
      [{ ...live, environment: "LIVE", keyPrefix: "fdk_biz_live_prefix" }],
      "LIVE",
    ),
  );
  for (const prefix of ["fdk_biz_sandbox_", "fdk_biz_test_"]) {
    const sandboxKey = { ...live, environment: "SANDBOX" as const, keyPrefix: prefix + "prefix" };
    assert.doesNotThrow(() => assertKeyEnvironment([sandboxKey], "SANDBOX"));
    assert.throws(() => assertKeyEnvironment([sandboxKey], "LIVE"));
    assert.throws(() => assertKeyEnvironment([{ ...sandboxKey, environment: "LIVE" }], "LIVE"));
  }
  const sandbox: ApiTransaction["transaction"] = {
    fondekaReference: "opaque-payment-001",
    environment: "SANDBOX",
    status: "PROCESSING",
    amount: 10,
    grossAmount: 10.3,
    fee: 0.3,
    currency: "USD",
    service: "BUSINESS_API",
    action: "BUSINESS_API_COLLECTION",
  };
  assert.doesNotThrow(() => assertTransactionEnvironment(sandbox, "SANDBOX"));
  assert.throws(() => assertTransactionEnvironment(sandbox, "LIVE"));
  assert.throws(() =>
    assertTransactionEnvironment({ ...sandbox, fondekaReference: "" }, "SANDBOX"),
  );
  assert.throws(() =>
    assertTransactionEnvironment(
      { ...sandbox, environment: undefined } as unknown as ApiTransaction["transaction"],
      "LIVE",
    ),
  );
  assert.doesNotThrow(() =>
    assertTransactionEnvironment(
      {
        ...sandbox,
        environment: "LIVE",
        fondekaReference: "SBX-looking-but-opaque",
        status: "COMPLETED",
      },
      "LIVE",
    ),
  );
});
test("demo sandbox history and credentials are isolated and retain non-payable fixtures", async () => {
  const live = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions",
  );
  const sandbox = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?environment=SANDBOX",
  );
  assert.equal(live.totalElements, 12);
  assert.equal(sandbox.totalElements, 6);
  assert.ok(
    sandbox.content.every(
      (row) =>
        row.transaction.environment === "SANDBOX" &&
        !Object.hasOwn(row.transaction, "transactionId") &&
        row.transaction.fee === 0,
    ),
  );
  assert.ok(
    live.content.every(
      (row) =>
        row.transaction.environment === "LIVE" && row.transaction.fondekaReference.startsWith("TX"),
    ),
  );
  const crypto = sandbox.content.find((row) => row.transaction.cryptoDetails)?.transaction
    .cryptoDetails;
  assert.match(crypto!.address!, /^SANDBOX_NOT_PAYABLE_/);
  assert.equal(crypto?.invoiceUrl, undefined);
  assert.equal(crypto?.exchangeRate, 1);
  assert.equal(crypto?.exchangeRateCurrency, "USD");
  const detail = await demoRequest<ApiTransaction>(
    apiTransactionPath(1, sandbox.content[0].transaction.fondekaReference, "SANDBOX"),
  );
  assert.equal(Object.hasOwn(detail.transaction, "transactionId"), false);
  await assert.rejects(
    demoRequest(apiTransactionPath(1, detail.transaction.fondekaReference, "LIVE")),
    /not found/,
  );
  await assert.rejects(
    demoRequest(apiTransactionPath(1, live.content[0].transaction.fondekaReference, "SANDBOX")),
    /not found/,
  );
  const keys = await demoRequest<ApiKey[]>(apiKeysPath(1, "SANDBOX"));
  assert.ok(
    keys.every(
      (key) => key.environment === "SANDBOX" && key.keyPrefix.startsWith("fdk_biz_sandbox_"),
    ),
  );
  const filtered = await demoRequest<Page<ApiTransaction>>(
    `/customer-api/businesses/1/api-transactions?${portalQuery({ ...emptyFilters, action: "BUSINESS_API_PAYOUT", status: "FAILED" }, 0, "SANDBOX")}`,
  );
  assert.equal(filtered.content.length, 1);
  assert.equal(filtered.content[0].transaction.failureCode, "INVALID_DESTINATION");
});

test("portal order filters and detail lookups share the 1.2.0 snapshot in both environments", async () => {
  for (const environment of ["LIVE", "SANDBOX"] as const) {
    const path = "/customer-api/businesses/1/api-transactions";
    const history = await demoRequest<Page<ApiTransaction>>(`${path}?environment=${environment}`);
    const payment = history.content[2].transaction;
    assert.ok(payment.orderReference);
    assert.equal(Object.hasOwn(payment, "clientReference"), false);
    const query = portalQuery(
      {
        ...emptyFilters,
        orderReference: ` ${payment.orderReference} `,
        reference: payment.fondekaReference,
      },
      0,
      environment,
    );
    const filtered = await demoRequest<Page<ApiTransaction>>(`${path}?${query}`);
    assert.equal(filtered.content.length, 1);
    assert.equal(filtered.content[0].transaction.orderReference, payment.orderReference);
    const detail = await demoRequest<ApiTransaction>(
      apiTransactionPath(1, payment.fondekaReference, environment),
    );
    assert.deepEqual(detail.transaction, filtered.content[0].transaction);
    const legacy = new URLSearchParams({ environment, clientReference: payment.orderReference });
    assert.equal((await demoRequest<Page<ApiTransaction>>(`${path}?${legacy}`)).content.length, 1);
    legacy.set("orderReference", ` ${payment.orderReference} `);
    assert.equal((await demoRequest<Page<ApiTransaction>>(`${path}?${legacy}`)).content.length, 1);
    legacy.set("orderReference", "different-order");
    await assert.rejects(demoRequest(`${path}?${legacy}`), { status: 400 });
  }
});
