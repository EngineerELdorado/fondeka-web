import { test } from "node:test";
import assert from "node:assert/strict";
import { billCatalogPath, billCatalogQuery, parseBillCatalog } from "../src/lib/api-bill-catalog";
import { allowedProxyRoute } from "../src/lib/proxy-policy";

const query = billCatalogQuery("10");
const product = {
  code: "SOCODEE",
  name: "SOCODEE",
  displayName: "Socodee",
  category: "ELECTRICITY",
  countryCodes: ["CD"],
  pricing: { status: "AVAILABLE", amount: 10, fee: 0.3, grossAmount: 10.3, currency: "USD" },
  commission: { basis: "NET_AMOUNT", percentage: 1.5, maxPoints: 50 },
};
const response = (pricingScope = "ACCOUNT") => ({
  environment: "LIVE",
  pricingScope,
  amount: 10,
  currency: "USD",
  calculatedAt: "2026-11-24T12:00:00Z",
  binding: false,
  products: [product],
});

test("bill discovery uses customer ownership for account prices and a separate public read", () => {
  assert.deepEqual(billCatalogQuery(), { currency: "USD" });
  assert.equal(
    billCatalogPath(billCatalogQuery(), 2),
    "/customer-api/businesses/2/api-bill-products?currency=USD",
  );
  const normalized = billCatalogQuery("10.5", "cdf", "cd");
  assert.deepEqual(normalized, { amount: "10.50", currency: "CDF", countryCode: "CD" });
  assert.match(
    billCatalogPath(normalized, 42),
    /^\/customer-api\/businesses\/42\/api-bill-products\?/,
  );
  assert.match(billCatalogPath(normalized), /^\/api\/public\/business-api\/bill-products\?/);
  for (const amount of ["0", "-1", "0.001", "1000001", "NaN", "10e2"])
    assert.throws(() => billCatalogQuery(amount));
  assert.throws(() => billCatalogPath(query, NaN));
  assert.throws(() => billCatalogQuery("10", "USDT"));
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-bill-products", "GET"), true);
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-bill-products", "POST"), false);
  assert.equal(allowedProxyRoute("business-api/v1/businesses/42/bill-products", "GET"), false);
});

test("informational bill discovery preserves configured tariffs without inferring a percentage from a sample quote", () => {
  const feeSchedule = {
    status: "AVAILABLE",
    currency: "USD",
    rangeAmountBasis: "REQUEST_AMOUNT",
    feeAmountBasis: "REQUEST_AMOUNT",
    quoteRequired: true,
    unavailableReason: null,
    ranges: [
      {
        minAmount: 0,
        maxAmountExclusive: null,
        available: true,
        fee: { percentage: 3, flatFee: 1, minimum: { percentage: 1, flatFee: 2 } },
      },
    ],
  };
  const value = {
    ...response("STANDARD"),
    amount: null,
    products: [{ ...product, pricing: null, feeSchedule: { ...feeSchedule, provider: "PRIVATE" } }],
  };
  const parsed = parseBillCatalog(value, billCatalogQuery(), true);
  const row = parsed.products[0];
  assert.deepEqual(row.feeSchedule, feeSchedule);
  assert.equal(row.pricing, undefined);
  assert.equal(row.commission, undefined);
  assert.deepEqual(
    parseBillCatalog(parsed, billCatalogQuery(), true).products[0].feeSchedule,
    feeSchedule,
  );
  assert.equal(
    parseBillCatalog(response("STANDARD"), billCatalogQuery(), true).products[0].feeSchedule,
    undefined,
  );
  for (const invalid of [
    { ...feeSchedule, currency: "CDF" },
    {
      ...feeSchedule,
      ranges: [{ ...feeSchedule.ranges[0], fee: { percentage: -1, flatFee: 0, minimum: null } }],
    },
  ])
    assert.equal(
      parseBillCatalog(
        { ...value, products: [{ ...product, feeSchedule: invalid }] },
        billCatalogQuery(),
        true,
      ).products[0].feeSchedule,
      undefined,
    );
});

test("private bills retain eligible commission basis and caps; public discovery strips commissions and internals", () => {
  const privateRow = parseBillCatalog(response(), query, false).products[0];
  assert.deepEqual(privateRow.commission, { basis: "NET_AMOUNT", percentage: 1.5, maxPoints: 50 });
  assert.equal(privateRow.pricing?.fee, 0.3);
  const publicValue = response("STANDARD");
  publicValue.products[0] = { ...product, ...{ provider: "PRIVATE", id: 123, accountId: 7 } };
  const publicRow = parseBillCatalog(publicValue, query, true).products[0];
  assert.equal(
    parseBillCatalog(parseBillCatalog(publicValue, query, true), query, true).products[0].pricing
      ?.fee,
    0.3,
  );
  for (const key of ["commission", "provider", "id", "accountId"])
    assert.equal(Object.hasOwn(publicRow, key), false);
  assert.throws(() => parseBillCatalog(response(), query, true), /Invalid bill catalog/);
  assert.throws(() => parseBillCatalog(response("STANDARD"), query, false));
});

test("missing, inconsistent or foreign-currency prices never display as free", () => {
  for (const pricing of [
    undefined,
    { ...product.pricing, fee: undefined },
    { ...product.pricing, status: "UNAVAILABLE" },
    { ...product.pricing, currency: "CDF" },
    { ...product.pricing, grossAmount: 11 },
    { ...product.pricing, fee: -1 },
  ]) {
    const value = { ...response(), products: [{ ...product, pricing }] };
    assert.equal(parseBillCatalog(value, query, false).products[0].pricing, undefined);
  }
  const free = {
    ...response(),
    products: [{ ...product, pricing: { ...product.pricing, fee: 0, grossAmount: 10 } }],
  };
  assert.equal(parseBillCatalog(free, query, false).products[0].pricing?.fee, 0);
  assert.throws(() => parseBillCatalog({ ...response(), currency: "CDF" }, query, false));
});
