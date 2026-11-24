import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/public/business-api/bill-products/route";
import { GET as proxyGET } from "../src/app/api/backend/[...path]/route";
import { billCatalogPath, billCatalogQuery } from "../src/lib/api-bill-catalog";

test("account bill discovery reaches the backend proxy with its filters and device proof", async () => {
  const originalFetch = globalThis.fetch;
  const previousBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const catalog = { pricingScope: "ACCOUNT", products: [] };
  let forwarded = false;
  globalThis.fetch = async (url, init) => {
    forwarded = true;
    assert.equal(
      String(url),
      "https://backend.example/customer-api/businesses/2/api-bill-products?currency=USD",
    );
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-token");
    assert.equal(headers.get("x-device-id"), "test-device");
    assert.equal(headers.get("x-device-session"), "test-proof");
    assert.equal(init?.cache, "no-store");
    return Response.json(catalog);
  };
  try {
    const url = new URL(
      `/api/backend${billCatalogPath(billCatalogQuery(), 2)}`,
      "http://localhost:4200",
    );
    assert.equal(url.pathname, "/api/backend/customer-api/businesses/2/api-bill-products");
    const response = await proxyGET(
      new NextRequest(url, {
        headers: {
          Authorization: "Bearer test-token",
          "X-Device-Id": "test-device",
          "X-Device-Session": "test-proof",
        },
      }),
      { params: Promise.resolve({ path: url.pathname.slice("/api/backend/".length).split("/") }) },
    );
    assert.equal(forwarded, true);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), catalog);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = previousBase;
  }
});

test("public bill discovery reads tariff metadata without a sample amount or account credentials", async () => {
  const originalFetch = globalThis.fetch;
  const previousBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/public/business-api/bill-products");
    assert.deepEqual(Object.fromEntries(parsed.searchParams), {
      currency: "USD",
      countryCode: "CD",
    });
    assert.deepEqual(Object.fromEntries(new Headers(init?.headers)), {
      accept: "application/json",
      "accept-language": "fr",
    });
    assert.equal(init?.cache, "no-store");
    return Response.json({
      environment: "LIVE",
      pricingScope: "STANDARD",
      amount: null,
      currency: "USD",
      binding: false,
      calculatedAt: new Date().toISOString(),
      products: [
        {
          code: "SOCODEE",
          category: "ELECTRICITY",
          pricing: {
            status: "AVAILABLE",
            amount: 10,
            fee: 0.3,
            grossAmount: 10.3,
            currency: "USD",
          },
          feeSchedule: {
            status: "AVAILABLE",
            currency: "USD",
            rangeAmountBasis: "REQUEST_AMOUNT",
            feeAmountBasis: "REQUEST_AMOUNT",
            quoteRequired: true,
            unavailableReason: null,
            ranges: [
              {
                minAmount: 0,
                maxAmountExclusive: null,
                available: true,
                fee: { percentage: 3, flatFee: 0, minimum: null },
              },
            ],
            provider: "PRIVATE",
          },
          commission: { basis: "REVENUE", percentage: 50 },
          internalCost: 5,
        },
      ],
    });
  };
  try {
    const response = await GET(
      new NextRequest(
        "https://web.example/api/public/business-api/bill-products?countryCode=cd&accountId=7",
        {
          headers: {
            Authorization: "Bearer private-token",
            Cookie: "session=private",
            "X-API-Key": "secret",
            "Accept-Language": "fr",
          },
        },
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const product = (await response.json()).products[0];
    assert.equal(product.pricing.status, "AVAILABLE");
    assert.equal(product.pricing.currency, "USD");
    assert.equal(product.pricing.fee, 0.3);
    assert.equal(product.feeSchedule.ranges[0].fee.percentage, 3);
    assert.equal(product.feeSchedule.provider, undefined);
    assert.equal(product.commission, undefined);
    assert.equal(product.internalCost, undefined);
    globalThis.fetch = async () => {
      throw new Error("Unavailable");
    };
    assert.equal(
      (await GET(new NextRequest("https://web.example/api/public/business-api/bill-products")))
        .status,
      502,
    );
    assert.equal(
      (
        await GET(
          new NextRequest("https://web.example/api/public/business-api/bill-products?amount=0"),
        )
      ).status,
      400,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = previousBase;
  }
});
