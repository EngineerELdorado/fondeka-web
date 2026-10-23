import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/backend/[...path]/route";
import { allowedProxyRoute } from "../src/lib/proxy-policy";

const id = "6f6041df-85ea-47ee-9ee4-1f01f4097ef0";
test("Business Tools proxy permits exactly the customer purchase and instruction methods", () => {
  const accepted = [
    ["customer-api/business-tools/access", "GET"],
    ["customer-api/business-tools/subscriptions", "POST"],
    [`customer-api/business-tools/subscriptions/${id}`, "GET"],
    ["customer-api/transactions/789", "GET"],
    ["customer-api/crypto-networks/payment-methods/12/networks", "GET"],
  ];
  for (const [path, verb] of accepted) {
    assert.equal(allowedProxyRoute(path, verb), true);
    for (const disallowed of ["GET", "POST", "PATCH", "PUT", "DELETE"].filter(
      (method) => method !== verb,
    ))
      assert.equal(allowedProxyRoute(path, disallowed), false, `${disallowed} ${path}`);
  }
  for (const path of [
    "customer-api/business-tools/subscriptions/123",
    `customer-api/business-tools/subscriptions/${id}/cancel`,
    "customer-api/business-tools/admin/grants",
    "admin-api/business-tools",
    "customer-api/transactions/789/refund",
    "customer-api/transactions",
    "customer-api/crypto-networks/payment-methods/../networks",
  ])
    assert.equal(allowedProxyRoute(path, "POST"), false);
});
test("purchase proxy preserves body, locale, version and device proof without forwarding cookies or merchant credentials", async () => {
  const original = globalThis.fetch;
  const base = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ status: "PENDING", accessGranted: false });
  };
  try {
    const body = JSON.stringify({
      planCode: "SERVER_PLAN",
      idempotencyKey: `bt_${id}`,
      paymentMethod: { id: 12, fiatWalletId: 56, currency: "CDF", feeApplicationMode: "EXCLUSIVE" },
    });
    const response = await POST(
      new NextRequest(
        "http://localhost:4200/api/backend/customer-api/business-tools/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer customer.jwt.token",
            Origin: "http://localhost:4200",
            "X-Device-Id": "registered-browser",
            "X-Device-Session": "verified-session",
            "Accept-Language": "fr",
            "X-Client-Version": "1.0.97",
            "X-App-Version": "1.0.98",
            Cookie: "private-cookie",
            "X-API-Key": "merchant-secret",
          },
          body,
        },
      ),
      { params: Promise.resolve({ path: ["customer-api", "business-tools", "subscriptions"] }) },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init?.body, body);
    assert.equal(calls[0].init?.cache, "no-store");
    const headers = new Headers(calls[0].init?.headers);
    for (const [name, value] of [
      ["Accept-Language", "fr"],
      ["X-Client-Version", "1.0.97"],
      ["X-App-Version", "1.0.98"],
      ["X-Device-Id", "registered-browser"],
      ["X-Device-Session", "verified-session"],
      ["X-Device-Platform", "WEB"],
    ])
      assert.equal(headers.get(name), value);
    assert.equal(headers.get("Cookie"), null);
    assert.equal(headers.get("X-API-Key"), null);
    const details = await GET(
      new NextRequest("http://localhost:4200/api/backend/customer-api/transactions/789", {
        headers: { Authorization: "Bearer customer.jwt.token" },
      }),
      { params: Promise.resolve({ path: ["customer-api", "transactions", "789"] }) },
    );
    assert.equal(details.status, 200);
    assert.equal(calls[1].url, "https://backend.example/customer-api/transactions/789");
  } finally {
    globalThis.fetch = original;
    if (base === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = base;
  }
});
