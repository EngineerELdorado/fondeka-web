import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST, DELETE } from "../src/app/api/backend/[...path]/route";

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
        body: JSON.stringify({ name: "ERP", webhookUrl: "https://merchant.example/hooks" }),
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
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});
