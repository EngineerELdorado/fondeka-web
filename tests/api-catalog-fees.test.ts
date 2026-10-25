import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ApiCatalogFees } from "../src/components/api-catalog-fees";
import {
  catalogFeeBand,
  catalogFeeExample,
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
  assert.doesNotMatch(html, /Indicative account tariff|server determines final fees/);
  assert.doesNotMatch(html, /minimum fee of|0\.04%/i);
});

test("fee explanations use simple inclusive and exclusive examples", () => {
  const html = render();
  assert.match(html, /EXCLUSIVE/);
  assert.match(html, /adds fees on top/);
  assert.match(html, /add 0.50 USD in fees/);
  assert.match(html, /total is 10.50 USD/);
  assert.match(html, /INCLUSIVE/);
  assert.match(html, /9.50 USD is left/);
  assert.doesNotMatch(html, /lower bound|upper bound|funding history|net with EXCLUSIVE/);
});

test("examples follow the selected tariff, currency, minimum and actual collection band", () => {
  const selected = structuredClone(fees.collection);
  selected.currency = "CDF";
  selected.ranges = [
    {
      minAmount: 0,
      maxAmountExclusive: null,
      available: true,
      fee: { percentage: 5, flatFee: 0.5, minimum: { percentage: 2, flatFee: 1 } },
    },
  ];
  const example = catalogFeeExample(selected)!;
  assert.equal(example.currency, "CDF");
  assert.deepEqual(example.exclusive, { amount: 10, fee: 1.2, total: 11.2 });
  assert.deepEqual(example.inclusive, { amount: 10, fee: 1.2, net: 8.8 });
  selected.ranges = [
    {
      minAmount: 0,
      maxAmountExclusive: 10.01,
      available: true,
      fee: { percentage: 5, flatFee: 0, minimum: null },
    },
  ];
  const band = catalogFeeExample(selected)!;
  assert.ok(band.exclusive.total < 10.01);
  assert.ok(band.inclusive.amount < 10.01);
  selected.status = "PARTIAL";
  selected.ranges = [
    { minAmount: 0, maxAmountExclusive: 100, available: false, fee: null },
    {
      minAmount: 100,
      maxAmountExclusive: 100.01,
      available: true,
      fee: { percentage: 5, flatFee: 0, minimum: null },
    },
  ];
  const narrow = catalogFeeExample(selected)!;
  assert.ok(narrow.exclusive.total >= 100 && narrow.exclusive.total < 100.01);
  assert.ok(narrow.inclusive.amount >= 100 && narrow.inclusive.amount < 100.01);
  assert.equal(catalogFeeExample(fees.payout), undefined);
  assert.equal(catalogFeeExample(undefined), undefined);
  selected.ranges = [
    {
      minAmount: 0,
      maxAmountExclusive: 0.02,
      available: true,
      fee: { percentage: 5, flatFee: 0, minimum: null },
    },
  ];
  assert.equal(catalogFeeExample(selected), undefined);
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
