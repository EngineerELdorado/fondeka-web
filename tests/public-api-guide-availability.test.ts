import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/public/business-api/guide-availability/route";

test("public guides read current category flags without caching the whole-bill switch", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example/";
  let electricity = true;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://backend.example/public/business-api/guide-availability");
    assert.equal(init?.cache, "no-store");
    return Response.json({
      billPaymentsApiReady: false,
      billPaymentsApiAvailability: { ELECTRICITY: electricity, TELEVISION: false, WATER: false },
    });
  };
  try {
    const enabled = await GET();
    assert.equal(enabled.status, 200);
    assert.equal(enabled.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await enabled.json(), {
      billPaymentsApiReady: true,
      billPaymentsApiAvailability: { ELECTRICITY: true, TELEVISION: false, WATER: false },
    });
    electricity = false;
    const disabled = await GET();
    assert.deepEqual(await disabled.json(), {
      billPaymentsApiReady: false,
      billPaymentsApiAvailability: { ELECTRICITY: false, TELEVISION: false, WATER: false },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = originalBase;
  }
});

test("public availability outages stay distinguishable from disabled categories", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const upstream of [
      () => Promise.resolve(new Response("Unavailable", { status: 503 })),
      () => Promise.resolve(Response.json(null)),
      () => Promise.reject(new Error("Timed out")),
    ]) {
      globalThis.fetch = upstream;
      const response = await GET();
      assert.equal(response.status, 502);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.equal((await response.json()).billPaymentsApiAvailability, undefined);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
