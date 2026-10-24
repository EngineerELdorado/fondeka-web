import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiCatalogPath,
  catalogMethodsFor,
  catalogMethodSelectable,
  catalogNetworksFor,
  parseApiCatalog,
  type ApiCatalog,
} from "../src/lib/api-catalog";
import { demoRequest, resetDemo } from "../src/lib/demo";

const catalog: ApiCatalog = {
  paymentMethods: [
    {
      name: "MPESA_KENYA",
      displayName: "M-Pesa Kenya",
      type: "MOBILE_MONEY",
      countryCode: "KE",
      paymentCurrency: "KES",
      active: true,
      allowingCollection: true,
      allowingPayout: false,
      networkNames: [],
    },
    {
      name: "USDT",
      displayName: "Tether",
      type: "CRYPTO",
      countryCode: null,
      paymentCurrency: "USDT",
      active: true,
      allowingCollection: true,
      allowingPayout: true,
      networkNames: ["TRC20", "MISSING", "ERC20", "BASE"],
    },
  ],
  cryptoNetworks: [
    { name: "BASE", displayName: "Base", active: false, invoiceCreationEnabled: true },
    { name: "BTC", displayName: "Bitcoin", active: true, invoiceCreationEnabled: true },
    { name: "ERC20", displayName: "Ethereum", active: true, invoiceCreationEnabled: false },
    { name: "TRC20", displayName: "TRON", active: true, invoiceCreationEnabled: true },
  ],
};

test("catalog reads use a validated customer Business ID without an environment or merchant route", () => {
  assert.equal(apiCatalogPath(42), "/customer-api/businesses/42/api-catalog");
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => apiCatalogPath(id));
});

test("catalog parsing preserves exact identifiers, foreign countries, metadata and association order", () => {
  const parsed = parseApiCatalog(structuredClone(catalog));
  assert.deepEqual(parsed, catalog);
  assert.equal(parsed.paymentMethods[0].countryCode, "KE");
  assert.equal(parsed.paymentMethods[1].paymentCurrency, "USDT");
  assert.deepEqual(parseApiCatalog({ paymentMethods: [], cryptoNetworks: [] }), {
    paymentMethods: [],
    cryptoNetworks: [],
  });
  for (const invalid of [
    null,
    {},
    { paymentMethods: [], cryptoNetworks: null },
    { ...catalog, paymentMethods: [{ ...catalog.paymentMethods[0], active: "true" }] },
    { ...catalog, paymentMethods: [{ ...catalog.paymentMethods[0], name: "M-Pesa Kenya" }] },
    { ...catalog, paymentMethods: [{ ...catalog.paymentMethods[0], type: "BANK" }] },
    { ...catalog, cryptoNetworks: [{ name: "TRC20", active: true }] },
    { ...catalog, paymentMethods: [catalog.paymentMethods[0], catalog.paymentMethods[0]] },
  ])
    assert.throws(() => parseApiCatalog(invalid));
});

test("inactive methods are hidden and unselectable in both environments, preserving family and country context", () => {
  const inactive = { ...catalog.paymentMethods[0], name: "AIRTEL_MONEY_DRC", active: false };
  const mixed = { ...catalog, paymentMethods: [inactive, ...catalog.paymentMethods] };
  assert.deepEqual(catalogMethodsFor(mixed, "MOBILE_MONEY"), [catalog.paymentMethods[0]]);
  assert.deepEqual(catalogMethodsFor(mixed, "CRYPTO"), [catalog.paymentMethods[1]]);
  assert.deepEqual(catalogMethodsFor({ ...mixed, paymentMethods: [inactive] }, "MOBILE_MONEY"), []);
  for (const environment of ["LIVE", "SANDBOX"] as const)
    for (const payout of [false, true])
      assert.equal(catalogMethodSelectable(inactive, environment, payout), false);
  assert.equal(mixed.paymentMethods.length, 3);
});

test("active methods retain LIVE direction flags and sandbox simulation rules", () => {
  const method = catalog.paymentMethods[0];
  assert.equal(catalogMethodSelectable(method, "LIVE", false), true);
  assert.equal(catalogMethodSelectable(method, "LIVE", true), false);
  assert.equal(catalogMethodSelectable({ ...method, active: false }, "LIVE", false), false);
  assert.equal(catalogMethodSelectable({ ...method, active: false }, "SANDBOX", false), false);
  assert.equal(catalogMethodSelectable(method, "SANDBOX", true), true);
});

test("crypto networks use only method associations in priority order with environment and direction rules", () => {
  const method = catalog.paymentMethods[1];
  const names = (environment: "LIVE" | "SANDBOX", payout: boolean) =>
    catalogNetworksFor(catalog, method, environment, payout).map((network) => network.name);
  assert.deepEqual(names("LIVE", false), ["TRC20"]);
  assert.deepEqual(names("LIVE", true), ["TRC20", "ERC20"]);
  assert.deepEqual(names("SANDBOX", false), ["TRC20", "ERC20"]);
  assert.deepEqual(names("SANDBOX", true), ["TRC20", "ERC20"]);
  for (const environment of ["LIVE", "SANDBOX"] as const) {
    assert.deepEqual(
      catalogNetworksFor(catalog, { ...method, active: false }, environment, true),
      [],
    );
    assert.deepEqual(
      catalogNetworksFor(catalog, { ...method, networkNames: ["BASE"] }, environment, true),
      [],
    );
  }
  assert.deepEqual(catalogNetworksFor(catalog, catalog.paymentMethods[0], "LIVE", true), []);
  assert.deepEqual(
    catalogNetworksFor(catalog, { ...method, networkNames: [] }, "SANDBOX", false),
    [],
  );
});

test("demo catalog is read-only, owned-Business scoped and includes non-owner countries", async () => {
  resetDemo();
  const before = await demoRequest("/customer-api/businesses/1/api-wallets?environment=SANDBOX");
  const parsed = parseApiCatalog(await demoRequest(apiCatalogPath(1)));
  assert.ok(parsed.paymentMethods.some((method) => method.countryCode === "KE"));
  assert.ok(parsed.paymentMethods.some((method) => !method.active));
  assert.deepEqual(
    await demoRequest("/customer-api/businesses/1/api-wallets?environment=SANDBOX"),
    before,
  );
  await assert.rejects(demoRequest(apiCatalogPath(2)), { status: 404 });
});
