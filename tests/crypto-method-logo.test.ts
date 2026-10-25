import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cryptoMethodLogo } from "../src/lib/crypto-method-logo";
import { CatalogCryptoLogo, CatalogMethodLogo } from "../src/components/catalog-method-logo";
import { parseApiCatalog, type ApiCatalogMethod } from "../src/lib/api-catalog";

test("configured crypto tokens use local mobile-app logos; categories and unknown names keep a generic icon", () => {
  for (const name of ["BTC", "ETH", "USDT", "USDC", "BNB", "SOL", "EURC", "BTC_LIGHTENING"]) {
    const source = cryptoMethodLogo(name)!;
    assert.ok(source.startsWith("/payment-methods/cryptos/"));
    const svg = readFileSync(`public${source}`, "utf8");
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|javascript:/i);
    const html = renderToStaticMarkup(createElement(CatalogCryptoLogo, { name }));
    assert.match(html, /<img/);
    assert.ok(html.includes(source));
  }
  for (const name of ["STABLECOINS", "OTHER_CRYPTOS", "UNKNOWN", "../../evil"]) {
    assert.equal(cryptoMethodLogo(name), undefined);
    assert.doesNotMatch(renderToStaticMarkup(createElement(CatalogCryptoLogo, { name })), /<img/);
  }
});

test("configured mobile-money logo URLs are preserved and rendered, with safe missing/invalid URL fallbacks", () => {
  const method: ApiCatalogMethod = {
    name: "MPESA_DRC",
    displayName: "M-Pesa",
    type: "MOBILE_MONEY",
    countryCode: "CD",
    logoUrl: "https://media.example/mpesa.png",
    active: true,
    allowingCollection: true,
    allowingPayout: true,
    networkNames: [],
  };
  const parsed = parseApiCatalog({ paymentMethods: [method], cryptoNetworks: [] });
  assert.equal(parsed.paymentMethods[0].logoUrl, method.logoUrl);
  assert.match(
    renderToStaticMarkup(createElement(CatalogMethodLogo, { method })),
    /src="https:\/\/media.example\/mpesa.png"/,
  );
  for (const logoUrl of [undefined, null, "javascript:alert(1)"]) {
    assert.doesNotMatch(
      renderToStaticMarkup(createElement(CatalogMethodLogo, { method: { ...method, logoUrl } })),
      /<img/,
    );
  }
  assert.throws(() =>
    parseApiCatalog({ paymentMethods: [{ ...method, logoUrl: 42 }], cryptoNetworks: [] }),
  );
});
