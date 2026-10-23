import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { allowedProxyRoute } from "../src/lib/proxy-policy";
import { GET, POST } from "../src/app/api/backend/[...path]/route";

test("the portal gateway permits scoped credential management but rejects payment/admin mutations", () => {
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-keys", "GET"), true);
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-keys", "POST"), true);
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-keys/8", "DELETE"), true);
  for (const method of ["DELETE", "PATCH", "PUT"])
    assert.equal(allowedProxyRoute("customer-api/businesses/42/api-keys", method), false);
  for (const path of [
    "admin-api/businesses/42/api-keys",
    "business-api/v1/businesses/42/collections",
    "customer-api/businesses/../../admin-api",
    "https://evil.example",
    "customer-api/businesses/42/../43/api-keys",
  ])
    assert.equal(allowedProxyRoute(path, "POST"), false);
});
test("gateway requires customer bearer authentication before contacting the backend", async () => {
  const response = await GET(
    new NextRequest("http://localhost:4200/api/backend/customer-api/businesses"),
    { params: Promise.resolve({ path: ["customer-api", "businesses"] }) },
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("gateway forwards device proof and filters, never cookies or API keys", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  let upstream: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    upstream = { url: String(url), init };
    return Response.json({ content: [], totalElements: 0 });
  };
  try {
    const response = await GET(
      new NextRequest(
        "http://localhost:4200/api/backend/customer-api/businesses/42/api-transactions?status=PROCESSING&currency=CDF",
        {
          headers: {
            Authorization: "Bearer header.payload.signature",
            "X-Device-Id": "browser-123",
            "X-Device-Session": "proof-token",
            "X-API-Key": "must-not-forward",
            Cookie: "must-not-forward",
          },
        },
      ),
      {
        params: Promise.resolve({ path: ["customer-api", "businesses", "42", "api-transactions"] }),
      },
    );
    assert.equal(response.status, 200);
    assert.equal(
      upstream?.url,
      "https://backend.example/customer-api/businesses/42/api-transactions?status=PROCESSING&currency=CDF",
    );
    const headers = new Headers(upstream?.init?.headers);
    assert.equal(headers.get("X-Device-Id"), "browser-123");
    assert.equal(headers.get("X-Device-Session"), "proof-token");
    assert.equal(headers.get("X-Device-Platform"), "WEB");
    assert.equal(headers.get("X-API-Key"), null);
    assert.equal(headers.get("Cookie"), null);
    assert.equal(upstream?.init?.redirect, "error");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
test("gateway rejects cross-origin writes", async () => {
  const response = await POST(
    new NextRequest("http://localhost:4200/api/backend/customer-api/payment_requests", {
      method: "POST",
      headers: { Authorization: "Bearer token", Origin: "https://another.example" },
      body: "{}",
    }),
    { params: Promise.resolve({ path: ["customer-api", "payment_requests"] }) },
  );
  assert.equal(response.status, 403);
});
