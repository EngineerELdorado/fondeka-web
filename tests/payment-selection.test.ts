import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appStoreUrl,
  playStoreUrl,
  devicePlatform,
  registrationStore,
} from "../src/lib/app-stores";
import { groupPaymentMethods } from "../src/lib/payment-method-groups";
import {
  countryFromHeaders,
  normalizeCountry,
  resolvePaymentCountry,
  countryOptions,
  filterCountries,
} from "../src/lib/payment-country";
import { paymentMethodsPath, type PaymentMethod } from "../src/lib/business-tools";

test("registration routes real mobile platforms to the same stores as the website, while desktop gets a QR choice", () => {
  const android = {
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8)",
    platform: "Linux armv8l",
    maxTouchPoints: 5,
  };
  const iphone = {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    platform: "iPhone",
    maxTouchPoints: 5,
  };
  const ipad = {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
    platform: "MacIntel",
    maxTouchPoints: 5,
  };
  assert.equal(devicePlatform(android), "android");
  assert.equal(registrationStore(android), playStoreUrl);
  for (const device of [iphone, ipad, { ...iphone, userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0)" }])
    assert.equal(registrationStore(device), appStoreUrl);
  for (const device of [
    undefined,
    { ...ipad, maxTouchPoints: 0 },
    { userAgent: "Mozilla/5.0 (Windows NT 10.0)", platform: "Win32", maxTouchPoints: 10 },
  ])
    assert.equal(registrationStore(device), undefined);
  assert.equal(new URL(playStoreUrl).searchParams.get("id"), "com.fondeka.app");
  assert.equal(new URL(appStoreUrl).pathname, "/cd/app/fondeka/id6757371679");
});
test("method groups keep backend identities, USD priority and descending wallet balance without modifying their source", () => {
  const methods: PaymentMethod[] = [
    { id: 1, name: "EUR wallet", type: "BALANCE", currency: "EUR", balance: 40, fiatWalletId: 1 },
    { id: 9, name: "Airtel", type: "MOBILE_MONEY", currency: "CDF" },
    {
      id: 2,
      name: "CDF wallet",
      type: "BALANCE",
      currency: "CDF",
      balance: 200000,
      fiatWalletId: 2,
    },
    { id: 6, name: "Bank", type: "BANK", currency: "USD" },
    { id: 4, name: "USDT", type: "CRYPTO" },
    { id: 3, name: "USD wallet", type: "BALANCE", currency: "USD", balance: 2, fiatWalletId: 3 },
    { id: 5, name: "BTC", type: "CRYPTO" },
    { id: 7, name: "USD wallet", type: "BALANCE", currency: "USD", balance: 20, fiatWalletId: 7 },
    {
      id: 8,
      name: "Unknown balance",
      type: "BALANCE",
      currency: "GBP",
      balance: null,
      fiatWalletId: 8,
    },
  ];
  const before = structuredClone(methods);
  const groups = groupPaymentMethods(methods);
  assert.deepEqual(
    groups.map((g) => g.type),
    ["BALANCE", "MOBILE_MONEY", "CRYPTO", "BANK"],
  );
  assert.deepEqual(
    groups[0].methods.map((m) => m.id),
    [7, 3, 2, 1, 8],
  );
  assert.deepEqual(
    groups.find((group) => group.type === "CRYPTO")!.methods.map((m) => m.id),
    [4, 5],
  );
  assert.deepEqual(methods, before);
  assert.deepEqual(new Set(groups.flatMap((g) => g.methods)), new Set(methods));
  assert.deepEqual(
    groupPaymentMethods([methods[1]]).map((g) => g.type),
    ["MOBILE_MONEY"],
  );
  assert.deepEqual(groupPaymentMethods([]), []);
});
test("country detection matches checkout edge headers and rejects unknown or malformed values", () => {
  for (const name of [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "cloudfront-viewer-country",
  ])
    assert.equal(countryFromHeaders(new Headers({ [name]: "ke" })), "KE");
  assert.equal(
    countryFromHeaders(
      new Headers({ "x-vercel-ip-country": "XX", "cf-ipcountry": "T1", "x-country-code": "LU" }),
    ),
    "LU",
  );
  assert.equal(
    countryFromHeaders(new Headers({ "x-vercel-ip-country": "US", "cf-ipcountry": "CD" })),
    "US",
  );
  for (const value of [null, "", "XX", "EU", "ZZ", "Congo", "USA", "US, CD", 42])
    assert.equal(normalizeCountry(value), undefined);
  assert.equal(countryFromHeaders(new Headers()), undefined);
});
test("detection resolves before method discovery and a manual choice wins across account refreshes", () => {
  assert.equal(resolvePaymentCountry({ accountLoading: true }), undefined);
  assert.equal(
    resolvePaymentCountry({ detected: "KE", accountCountry: "CD", accountLoading: true }),
    "KE",
  );
  assert.equal(resolvePaymentCountry({ accountCountry: "CD" }), "CD");
  assert.equal(resolvePaymentCountry({}), "CD");
  for (const accountCountry of [undefined, "CD", "FR", "US"]) {
    const country = resolvePaymentCountry({
      selected: "LU",
      detected: "KE",
      accountCountry,
      accountLoading: true,
    });
    assert.equal(country, "LU");
    assert.equal(
      new URL(
        paymentMethodsPath({ action: "BUSINESS_TOOLS_ACCESS" }, country),
        "https://portal.test",
      ).searchParams.get("countryCode"),
      "LU",
    );
  }
});
test("the country picker finds localized names, ISO codes and calling codes with complete flags", () => {
  const english = countryOptions("en"),
    french = countryOptions("fr");
  assert.equal(english[0].code, "CD");
  assert.equal(new Set(english.map((c) => c.code)).size, english.length);
  assert.equal(french.find((c) => c.code === "CD")?.flag, "🇨🇩");
  assert.equal(filterCountries(french, "Etats-Unis")[0]?.code, "US");
  assert.ok(filterCountries(english, "+254").some((c) => c.code === "KE"));
  assert.ok(filterCountries(french, "lu").some((c) => c.code === "LU"));
  assert.deepEqual(filterCountries(english, "not a country"), []);
});
