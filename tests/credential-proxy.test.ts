import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST, DELETE, PATCH } from "../src/app/api/backend/[...path]/route";
import { allowedProxyRoute } from "../src/lib/proxy-policy";

test("the webhook allowlist permits only an exact customer PATCH, never a key or admin wildcard", () => {
  const route = "customer-api/businesses/42/api-keys/8/webhook";
  assert.equal(allowedProxyRoute(route, "PATCH"), true);
  for (const method of ["GET", "POST", "PUT", "DELETE"])
    assert.equal(allowedProxyRoute(route, method), false);
  for (const path of [
    "admin-api/businesses/42/api-keys/8/webhook",
    "business-api/v1/businesses/42/api-keys/8/webhook",
    "customer-api/businesses/42/api-keys/8",
    "customer-api/businesses/42/api-keys/8/webhook/",
    "customer-api/businesses/42/api-keys/8/webhook/extra",
    "customer-api/businesses/name/api-keys/8/webhook",
    "customer-api/businesses/42/api-keys/key/webhook",
    "customer-api/businesses/42/../43/api-keys/8/webhook",
  ])
    assert.equal(allowedProxyRoute(path, "PATCH"), false);
});

test("webhook editing preserves its URL-only body, customer authentication and device context with CSRF and no-store", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const body = JSON.stringify({ webhookUrl: "https://merchant.example/new" });
  const metadata = {
    id: 8,
    businessId: 42,
    name: "ERP",
    keyPrefix: "fdk_biz_prefix",
    enabled: true,
    webhookUrl: "https://merchant.example/new",
    environment: "SANDBOX",
  };
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://backend.example/customer-api/businesses/42/api-keys/8/webhook",
    );
    assert.equal(init?.method, "PATCH");
    assert.equal(init?.body, body);
    assert.equal(init?.cache, "no-store");
    const forwarded = new Headers(init?.headers);
    assert.equal(forwarded.get("Authorization"), "Bearer customer.jwt.token");
    assert.equal(forwarded.get("X-Device-Id"), "browser-device");
    assert.equal(forwarded.get("X-Device-Session"), "trusted-session");
    assert.equal(forwarded.get("X-Device-Platform"), "WEB");
    assert.equal(forwarded.get("Accept-Language"), "fr");
    assert.equal(forwarded.get("X-API-Key"), null);
    return Response.json(metadata);
  };
  const url = "http://localhost:4200/api/backend/customer-api/businesses/42/api-keys/8/webhook";
  const params = {
    params: Promise.resolve({
      path: ["customer-api", "businesses", "42", "api-keys", "8", "webhook"],
    }),
  };
  const headers = {
    Authorization: "Bearer customer.jwt.token",
    "X-Device-Id": "browser-device",
    "X-Device-Session": "trusted-session",
    "Accept-Language": "fr",
    "X-API-Key": "must-not-forward",
  };
  try {
    assert.equal(
      (await PATCH(new NextRequest(url, { method: "PATCH", body }), params)).status,
      401,
    );
    assert.equal(
      (
        await PATCH(
          new NextRequest(url, {
            method: "PATCH",
            body,
            headers: { ...headers, Origin: "https://foreign.example" },
          }),
          params,
        )
      ).status,
      403,
    );
    assert.equal(calls, 0);
    const response = await PATCH(
      new NextRequest(url, {
        method: "PATCH",
        body,
        headers: { ...headers, Origin: "http://localhost:4200" },
      }),
      params,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), metadata);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});

test("credential creation and revocation are customer-authenticated and uncached", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json(
          { credential: { id: 8 }, apiKey: "one-time-key", webhookSecret: "one-time-secret" },
          { status: 201 },
        );
  };
  try {
    const headers = {
      Authorization: "Bearer customer.jwt.token",
      Origin: "http://localhost:4200",
      "X-Device-Id": "browser-device",
      "X-Device-Session": "device-proof",
    };
    const created = await POST(
      new NextRequest("http://localhost:4200/api/backend/customer-api/businesses/42/api-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "ERP",
          webhookUrl: "https://merchant.example/hooks",
          environment: "SANDBOX",
        }),
      }),
      { params: Promise.resolve({ path: ["customer-api", "businesses", "42", "api-keys"] }) },
    );
    assert.equal(created.status, 201);
    assert.equal(created.headers.get("cache-control"), "no-store");
    assert.equal((await created.json()).apiKey, "one-time-key");
    const revoked = await DELETE(
      new NextRequest("http://localhost:4200/api/backend/customer-api/businesses/42/api-keys/8", {
        method: "DELETE",
        headers,
      }),
      { params: Promise.resolve({ path: ["customer-api", "businesses", "42", "api-keys", "8"] }) },
    );
    assert.equal(revoked.status, 204);
    assert.equal(revoked.headers.get("cache-control"), "no-store");
    assert.equal(calls[1].url, "https://backend.example/customer-api/businesses/42/api-keys/8");
    assert.equal(new Headers(calls[0].init?.headers).get("X-Device-Session"), "device-proof");
    assert.equal(calls[0].init?.cache, "no-store");
    assert.equal(JSON.parse(String(calls[0].init?.body)).environment, "SANDBOX");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
test("portal environment selectors are preserved on key, history and SBX detail reads", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const urls: string[] = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return Response.json({});
  };
  try {
    for (const path of [
      "api-keys",
      "api-transactions",
      "api-transactions/SBX0123456789abcdef0123456789abcdef",
    ]) {
      const route = `customer-api/businesses/42/${path}`;
      const response = await GET(
        new NextRequest(`http://localhost:4200/api/backend/${route}?environment=SANDBOX`, {
          headers: { Authorization: "Bearer customer.jwt.token" },
        }),
        { params: Promise.resolve({ path: route.split("/") }) },
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(urls.at(-1), `https://backend.example/${route}?environment=SANDBOX`);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
