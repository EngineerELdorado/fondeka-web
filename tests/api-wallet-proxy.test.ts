import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/backend/[...path]/route";
import { allowedProxyRoute } from "../src/lib/proxy-policy";

test("wallet proxy allows only the customer balance, paged sandbox ledger and top-up operations", () => {
  const routes = [
    ["customer-api/businesses/42/api-wallets", "GET"],
    ["customer-api/businesses/42/sandbox-wallets/USD/entries", "GET"],
    ["customer-api/businesses/42/sandbox-wallets/top-ups", "POST"],
    ["customer-api/businesses/42/sandbox-wallets/convert/quote", "POST"],
    ["customer-api/businesses/42/sandbox-wallets/convert", "POST"],
  ];
  for (const [path, method] of routes) {
    assert.equal(allowedProxyRoute(path, method), true);
    for (const other of ["GET", "POST", "PUT", "PATCH", "DELETE"].filter(
      (other) => other !== method,
    ))
      assert.equal(allowedProxyRoute(path, other), false);
  }
  for (const path of [
    "business-api/v1/businesses/42/wallets",
    "business-api/v1/businesses/42/sandbox-wallets/top-ups",
    "admin-api/businesses/42/sandbox-wallets/top-ups",
    "customer-api/businesses/42/sandbox-wallets/USD/reset",
    "customer-api/businesses/42/sandbox-wallets/USD/refund",
    "customer-api/businesses/42/sandbox-wallets/USDT/entries",
    "customer-api/businesses/42/sandbox-wallets/USD/entries/1",
    "customer-api/businesses/42/sandbox-wallets/USD/entries/../top-ups",
    "customer-api/businesses/42/sandbox-wallets/convert/cancel",
    "customer-api/businesses/42/sandbox-wallets/convert/quote/1",
    "customer-api/fiat-wallets/convert",
    "business-api/v1/businesses/42/sandbox-wallets/convert",
    "admin-api/businesses/42/sandbox-wallets/convert",
  ])
    for (const method of ["GET", "POST", "DELETE"])
      assert.equal(allowedProxyRoute(path, method), false);
});
test("wallet proxy keeps customer/device authentication, exact query and funding key with no-store", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({});
  };
  const headers = {
    Authorization: "Bearer customer.jwt",
    Origin: "http://localhost:4200",
    "Accept-Language": "fr",
    "Idempotency-Key": "portal-funding-001",
    "X-Device-Id": "browser",
    "X-Device-Session": "proof",
    "X-API-Key": "merchant-key-never-forward",
    Cookie: "session=never-forward",
  };
  const context = (route: string) => ({ params: Promise.resolve({ path: route.split("/") }) });
  try {
    const fundingRoute = "customer-api/businesses/42/sandbox-wallets/top-ups";
    const body = JSON.stringify({ currency: "USD", amount: 100.25 });
    const topUp = await POST(
      new NextRequest(`http://localhost:4200/api/backend/${fundingRoute}`, {
        method: "POST",
        headers,
        body,
      }),
      context(fundingRoute),
    );
    assert.equal(topUp.status, 200);
    assert.equal(topUp.headers.get("cache-control"), "no-store");
    const forwarded = new Headers(calls[0].init?.headers);
    for (const name of [
      "Authorization",
      "Accept-Language",
      "Idempotency-Key",
      "X-Device-Id",
      "X-Device-Session",
    ])
      assert.equal(forwarded.get(name), headers[name as keyof typeof headers]);
    assert.equal(forwarded.get("X-API-Key"), null);
    assert.equal(forwarded.get("Cookie"), null);
    assert.equal(calls[0].init?.body, body);
    assert.equal(calls[0].init?.cache, "no-store");
    assert.equal(calls[0].init?.redirect, "error");
    for (const suffix of ["convert", "convert/quote"]) {
      const route = `customer-api/businesses/42/sandbox-wallets/${suffix}`;
      const conversionBody = JSON.stringify({
        sourceCurrency: "USD",
        targetCurrency: "EUR",
        amount: 10,
      });
      const response = await POST(
        new NextRequest(`http://localhost:4200/api/backend/${route}`, {
          method: "POST",
          headers,
          body: conversionBody,
        }),
        context(route),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(calls.at(-1)?.url, `https://backend.example/${route}`);
      const proof = new Headers(calls.at(-1)?.init?.headers);
      assert.equal(
        proof.get("Idempotency-Key"),
        suffix === "convert" ? headers["Idempotency-Key"] : null,
      );
      assert.equal(proof.get("X-Device-Session"), "proof");
      assert.equal(proof.get("Authorization"), "Bearer customer.jwt");
      assert.equal(proof.get("X-API-Key"), null);
      assert.equal(calls.at(-1)?.init?.body, conversionBody);
    }
    for (const route of [
      "customer-api/businesses/42/api-wallets?environment=SANDBOX&currency=CDF",
      "customer-api/businesses/42/sandbox-wallets/USD/entries?page=1&size=20",
    ]) {
      const response = await GET(
        new NextRequest(`http://localhost:4200/api/backend/${route}`, { headers }),
        context(route.split("?")[0]),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(calls.at(-1)?.url, `https://backend.example/${route}`);
      assert.equal(new Headers(calls.at(-1)?.init?.headers).get("Idempotency-Key"), null);
    }
    const before = calls.length;
    const rejected = await POST(
      new NextRequest(`http://localhost:4200/api/backend/${fundingRoute}`, {
        method: "POST",
        headers: { ...headers, Origin: "https://foreign.example" },
        body,
      }),
      context(fundingRoute),
    );
    assert.equal(rejected.status, 403);
    assert.equal(calls.length, before);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
