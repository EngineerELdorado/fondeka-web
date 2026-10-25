import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CurrencyBadge } from "../src/components/currency-identity";
import { filterCatalogGroups, groupCatalogMethods } from "../src/lib/api-catalog-groups";
import type { ApiCatalogMethod } from "../src/lib/api-catalog";

const method = (
  name: string,
  countryCode?: string,
  paymentCurrency?: string,
): ApiCatalogMethod => ({
  name,
  displayName: name,
  countryCode,
  paymentCurrency,
  type: "MOBILE_MONEY",
  active: true,
  allowingCollection: true,
  allowingPayout: true,
  networkNames: [],
});
const methods = [
  method("MPESA_KENYA", "KE", "KES"),
  method("ORANGE_MONEY_COTE_DIVOIRE", "CI", "XOF"),
  method("MPESA_DRC", "CD", "USD"),
  method("MPESA_DRC_CDF", "CD", "CDF"),
  method("AIRTEL_MONEY_UGANDA", "UG", "UGX"),
  method("UNKNOWN_COUNTRY", "ZZ"),
];

test("country groups rank DRC first, sort other localized names and preserve methods and currencies", () => {
  const before = structuredClone(methods);
  const groups = groupCatalogMethods(methods, "en");
  assert.deepEqual(
    groups.map((group) => group.code),
    ["CD", "CI", "KE", "UG", "OTHER"],
  );
  assert.equal(groups[0].name, "DR Congo");
  assert.equal(groups[0].flag, "🇨🇩");
  assert.equal(groups.find((group) => group.code === "KE")?.name, "Kenya");
  assert.deepEqual(
    groups[0].methods.map((item) => [item.name, item.paymentCurrency]),
    [
      ["MPESA_DRC", "USD"],
      ["MPESA_DRC_CDF", "CDF"],
    ],
  );
  assert.equal(groups[0].methods[0], methods[2]);
  assert.equal(groups.at(-1)?.methods[0], methods[5]);
  assert.deepEqual(new Set(groups.flatMap((group) => group.methods)), new Set(methods));
  assert.deepEqual(methods, before);
  assert.equal(groupCatalogMethods(methods, "fr")[0].name, "RD Congo");
  assert.deepEqual(groupCatalogMethods([], "en"), []);
});

test("country selection uses ISO values and combines with name, identifier, currency and accent-insensitive search", () => {
  const groups = groupCatalogMethods(methods, "fr");
  const before = structuredClone(groups);
  const selected = filterCatalogGroups(groups, "CD", "cdf");
  assert.deepEqual(
    selected.map((group) => group.code),
    ["CD"],
  );
  assert.deepEqual(
    selected[0].methods.map((item) => item.name),
    ["MPESA_DRC_CDF"],
  );
  assert.equal(selected[0].methods[0].paymentCurrency, "CDF");
  assert.deepEqual(filterCatalogGroups(groups, "KE", "M-Pesa"), []);
  assert.equal(filterCatalogGroups(groups, "KE", "mpesa_kenya")[0].methods[0], methods[0]);
  assert.equal(filterCatalogGroups(groups, "", "cote")[0].code, "CI");
  assert.equal(filterCatalogGroups(groups, "", "RDC")[0].code, "CD");
  assert.equal(filterCatalogGroups(groups, "", "DRC")[0].code, "CD");
  assert.equal(filterCatalogGroups(groups, "OTHER", "")[0].methods[0], methods[5]);
  assert.deepEqual(filterCatalogGroups(groups, "KE", "USD"), []);
  assert.deepEqual(filterCatalogGroups(groups, "US", ""), []);
  assert.deepEqual(filterCatalogGroups(groups, "", "unknown payment"), []);
  assert.equal(
    filterCatalogGroups(groups, "", "").flatMap((group) => group.methods).length,
    methods.length,
  );
  assert.deepEqual(groups, before);
});

test("universal crypto methods stay discoverable without inventing a country or fiat currency", () => {
  const crypto = { ...method("USDT", undefined, "USDT"), type: "CRYPTO" as const };
  const groups = groupCatalogMethods([crypto], "en");
  assert.equal(groups[0].name, "Global");
  assert.equal(groups[0].countryCode, undefined);
  assert.equal(groups[0].flag, undefined);
  assert.equal(filterCatalogGroups(groups, "", "usdt")[0].methods[0], crypto);
  assert.equal(crypto.paymentCurrency, "USDT");
});

test("method currency badges retain distinct USD and CDF colors and support crypto metadata", () => {
  const badge = (currency: string) =>
    renderToStaticMarkup(createElement(CurrencyBadge, { currency }));
  const usd = badge("USD"),
    cdf = badge("CDF");
  assert.match(usd, /data-currency="USD"/);
  assert.match(cdf, /data-currency="CDF"/);
  assert.notEqual(
    usd.match(/--currency-hue:([0-9]+)/)?.[1],
    cdf.match(/--currency-hue:([0-9]+)/)?.[1],
  );
  assert.match(badge(" usdt "), /data-currency="USDT"/);
});

test("currency badges avoid red and pink status colors, including XOF", () => {
  const badge = (currency: string) =>
    renderToStaticMarkup(createElement(CurrencyBadge, { currency }));
  assert.match(badge("XOF"), /--currency-hue:185/);
  assert.match(badge("XAF"), /--currency-hue:240/);
  for (const currency of [
    "USD",
    "CDF",
    "EUR",
    "XOF",
    "XAF",
    "KES",
    "GHS",
    "UGX",
    "NGN",
    "GBP",
    "BTC",
    "ETH",
    "USDT",
    "USDC",
    "SOL",
  ]) {
    const hue = Number(badge(currency).match(/--currency-hue:([0-9]+)/)?.[1]);
    assert.ok(
      hue >= 120 && hue <= 280,
      `${currency} should use a green, teal, blue or violet badge`,
    );
  }
});
