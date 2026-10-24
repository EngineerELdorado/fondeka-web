import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/backend/[...path]/route";
import { allowedProxyRoute } from "../src/lib/proxy-policy";

test("the error-catalog allowlist permits only the exact customer GET", () => {
  assert.equal(allowedProxyRoute("customer-api/businesses/42/api-error-codes", "GET"), true);
  for (const method of ["POST", "PATCH", "PUT", "DELETE"])
    assert.equal(allowedProxyRoute("customer-api/businesses/42/api-error-codes", method), false);
  for (const path of [
    "customer-api/businesses/api-error-codes",
    "customer-api/businesses/name/api-error-codes",
    "customer-api/businesses/42/api-error-codes/",
    "customer-api/businesses/42/api-error-codes/extra",
    "customer-api/businesses/42/../43/api-error-codes",
    "admin-api/businesses/42/api-error-codes",
    "business-api/v1/businesses/42/error-codes",
  ])
    assert.equal(allowedProxyRoute(path, "GET"), false);
});

test("metadata uses the customer JWT, trusted device and selected environment, with no merchant or simulation headers", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const route = "customer-api/businesses/42/api-error-codes";
  const params = { params: Promise.resolve({ path: route.split("/") }) };
  const headers = {
    Authorization: "Bearer customer.jwt.token",
    "X-Device-Id": "browser-42",
    "X-Device-Session": "trusted-proof",
    "Accept-Language": "fr",
    "X-API-Key": "never-forward",
    "X-Simulate-Error-Code": "never-simulate-metadata",
  };
  let calls = 0;
  let upstreamStatus = 200;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), `https://backend.example/${route}?environment=SANDBOX`);
    assert.equal(init?.method, "GET");
    assert.equal(init?.cache, "no-store");
    const forwarded = new Headers(init?.headers);
    assert.equal(forwarded.get("Authorization"), headers.Authorization);
    assert.equal(forwarded.get("X-Device-Id"), "browser-42");
    assert.equal(forwarded.get("X-Device-Session"), "trusted-proof");
    assert.equal(forwarded.get("Accept-Language"), "fr");
    assert.equal(forwarded.get("X-Device-Platform"), "WEB");
    assert.equal(forwarded.get("X-API-Key"), null);
    assert.equal(forwarded.get("X-Simulate-Error-Code"), null);
    return Response.json(
      upstreamStatus === 200
        ? { environment: "SANDBOX", endpoints: [] }
        : { errorCode: "TEST_ERROR", message: "Customer contract error" },
      { status: upstreamStatus },
    );
  };
  try {
    const url = `http://localhost:4200/api/backend/${route}?environment=SANDBOX`;
    assert.equal((await GET(new NextRequest(url), params)).status, 401);
    assert.equal(calls, 0);
    for (const status of [200, 400, 401, 403, 404]) {
      upstreamStatus = status;
      const result = await GET(new NextRequest(url, { headers }), params);
      assert.equal(result.status, status);
      assert.equal(result.headers.get("cache-control"), "no-store");
      if (status !== 200) assert.equal((await result.json()).errorCode, "TEST_ERROR");
    }
    assert.equal(calls, 5);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
