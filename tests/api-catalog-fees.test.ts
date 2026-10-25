import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiCatalogFees } from "../src/components/api-catalog-fees";
import {
  catalogFeeBand,
  catalogFeeExpression,
  validCatalogFees,
  type CatalogFees,
} from "../src/lib/api-catalog-fees";
import { parseApiCatalog, type ApiCatalogMethod } from "../src/lib/api-catalog";

const fees: CatalogFees = {
  environment: "LIVE",
  collection: {
    status: "AVAILABLE",
    currency: "USD",
    rangeAmountBasis: "GROSS_AMOUNT",
    feeAmountBasis: "REQUEST_AMOUNT",
    quoteRequired: true,
    unavailableReason: null,
    ranges: [
      {
        minAmount: 0,
        maxAmountExclusive: 100.01,
        available: true,
        fee: { percentage: 5, flatFee: 0, minimum: null },
      },
      {
        minAmount: 100.01,
        maxAmountExclusive: null,
        available: true,
        fee: { percentage: 4, flatFee: 0.5, minimum: { percentage: 2, flatFee: 1 } },
      },
    ],
  },
  payout: {
    status: "UNAVAILABLE",
    currency: "USD",
    rangeAmountBasis: "REQUEST_AMOUNT",
    feeAmountBasis: "REQUEST_AMOUNT",
    quoteRequired: true,
    unavailableReason: "ROUTE_UNAVAILABLE",
    ranges: [],
  },
};
const method: ApiCatalogMethod = {
  name: "MPESA_KENYA",
  type: "MOBILE_MONEY",
  active: true,
  allowingCollection: true,
  allowingPayout: true,
  networkNames: [],
  fees,
};
const render = (selected = method, environment: "LIVE" | "SANDBOX" = "LIVE", payout = false) =>
  renderToStaticMarkup(
    createElement(ApiCatalogFees, { method: selected, environment, payout, currency: "USD" }),
  );

test("catalog fees validate environment, action bases, currency, ranges and combined expressions", () => {
  assert.equal(validCatalogFees(fees, "USD"), true);
  assert.equal(validCatalogFees(undefined, "USD"), true);
  assert.equal(validCatalogFees(fees, "CDF"), false);
  const bad: unknown[] = [null, { ...fees, environment: "SANDBOX" }];
  for (const mutate of [
    (value: CatalogFees) => {
      value.collection.rangeAmountBasis = "REQUEST_AMOUNT";
    },
    (value: CatalogFees) => {
      value.payout.currency = "CDF";
    },
    (value: CatalogFees) => {
      value.collection.ranges[1].minAmount = 100;
    },
    (value: CatalogFees) => {
      value.collection.ranges[1].minAmount = 101;
    },
    (value: CatalogFees) => {
      value.collection.ranges[0].fee!.percentage = NaN;
    },
    (value: CatalogFees) => {
      value.collection.ranges[1].fee!.minimum!.flatFee = -1;
    },
    (value: CatalogFees) => {
      value.collection.ranges[0].available = false;
    },
    (value: CatalogFees) => {
      value.collection.ranges[0].fee = null;
    },
    (value: CatalogFees) => {
      value.collection.ranges[1].maxAmountExclusive = 200;
    },
  ]) {
    const value = structuredClone(fees);
    mutate(value);
    bad.push(value);
  }
  for (const value of bad) {
    assert.equal(validCatalogFees(value, "USD"), false);
    assert.throws(() =>
      parseApiCatalog({ paymentMethods: [{ ...method, fees: value }], cryptoNetworks: [] }, "USD"),
    );
  }
  assert.equal(
    parseApiCatalog({ paymentMethods: [method], cryptoNetworks: [] }, "USD").paymentMethods[0].fees,
    fees,
  );
});

test("fee text preserves percentage units, flat fees, and inclusive/exclusive range bounds", () => {
  assert.equal(catalogFeeExpression({ percentage: 5, flatFee: 0 }, "USD"), "5%");
  assert.equal(catalogFeeExpression({ percentage: 4, flatFee: 0.5 }, "USD"), "4% + 0.50 USD");
  assert.equal(catalogFeeExpression({ percentage: 0, flatFee: 1 }, "CDF"), "1.00 CDF");
  assert.equal(catalogFeeExpression({ percentage: 0, flatFee: 0 }, "USD"), "Free");
  assert.equal(
    catalogFeeExpression({ percentage: 2.5, flatFee: 0.5 }, "EUR", "fr"),
    "2,5% + 0,50 EUR",
  );
  assert.equal(catalogFeeBand(fees.collection.ranges[0], "USD"), "0.00 ≤ amount < 100.01 USD");
  assert.equal(catalogFeeBand(fees.collection.ranges[1], "USD"), "≥ 100.01 USD");
});

test("minimum pricing displays both combined expressions rather than a flat minimum", () => {
  const html = render();
  assert.match(html, /Higher of/);
  assert.match(html, /4% \+ 0.50 USD/);
  assert.match(html, /2% \+ 1.00 USD/);
  assert.match(html, /gross amount, including fees/);
  assert.match(html, /server determines final fees/);
  assert.doesNotMatch(html, /minimum fee of|0\.04%/i);
});

test("missing tariffs and partial bands are unavailable, while explicit zero fees are free", () => {
  const partial = structuredClone(fees);
  partial.collection.status = "PARTIAL";
  partial.collection.ranges[0] = { ...partial.collection.ranges[0], available: false, fee: null };
  partial.collection.ranges[1].fee = { percentage: 0, flatFee: 0, minimum: null };
  assert.equal(validCatalogFees(partial, "USD"), true);
  const html = render({ ...method, fees: partial });
  assert.match(html, /Pricing is unavailable for some amount bands/);
  assert.match(html, /Unavailable/);
  assert.match(html, />Free</);
  const missing = render({ ...method, fees: undefined });
  assert.match(missing, /Pricing unavailable/);
  assert.doesNotMatch(missing, />Free</);
  const unavailable = render(method, "LIVE", true);
  assert.match(unavailable, /No route is available/);
  assert.doesNotMatch(unavailable, /5%|Free/);
});

test("sandbox never advertises LIVE tariffs as fixture fees", () => {
  const html = render(method, "SANDBOX");
  assert.match(html, /synthetic fees/);
  assert.doesNotMatch(html, /5%|4%|1.00 USD|LIVE fee schedule|Amount band/);
});
