import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  commercePaymentSelection,
  commerceQuoteRequest,
  orderBuyerFee,
  parseCommerceQuote,
  type CommercePaymentQuote,
} from "../src/lib/commerce-payments";
import { parseQuote, type PaymentSelection } from "../src/lib/business-tools";
import { allowedProxyRoute } from "../src/lib/proxy-policy";
import { POST } from "../src/app/api/backend/[...path]/route";
import { demoRequest, resetDemo } from "../src/lib/demo";
import { receiptText } from "../src/lib/receipt";
import type { Order, Page, Product, PosInput } from "../src/lib/types";

const selection: PaymentSelection = {
  id: 22,
  currency: "USD",
  feeApplicationMode: "EXCLUSIVE",
  accountRef: "+243000000000",
  networkId: 7,
};
const mixed: CommercePaymentQuote = {
  commerceSubtotalAmount: 100,
  buyerFeeAmount: 2.5,
  merchantFeeAmount: 2.5,
  productFeeApplicationMode: "MIXED",
  appliedFeeApplicationMode: "INCLUSIVE",
  fees: 5,
  feesCurrency: "USD",
  netAmount: 97.5,
  netAmountCurrency: "USD",
  grossAmount: 102.5,
  grossAmountCurrency: "USD",
  totalToPay: 102.5,
  totalToPayCurrency: "USD",
  customerPaidProviderFeeAmount: 1,
  customerPaidProviderFeeCurrency: "USD",
  customerPaidProviderFeeIncludedInTotal: false,
  customerPaidProviderFeeMessage: "Provider charges this separately.",
};

test("Commerce quotes preserve total fees, merchant net and provider disclosures for both explicit modes and mixed baskets", () => {
  for (const [mode, buyerFee, merchantFee] of [
    ["EXCLUSIVE", 5, 0],
    ["INCLUSIVE", 0, 5],
    ["MIXED", 2.5, 2.5],
    ["MIXED", 1.5, 3.5],
    ["LEGACY", 0, 5],
  ] as const) {
    const body = {
      ...mixed,
      productFeeApplicationMode: mode,
      buyerFeeAmount: buyerFee,
      merchantFeeAmount: merchantFee,
      netAmount: 100 + buyerFee - 5,
      grossAmount: 100 + buyerFee,
      totalToPay: 100 + buyerFee,
    };
    const before = structuredClone(body);
    const quote = parseCommerceQuote(body, "USD");
    assert.equal(quote, body);
    assert.equal(quote.fees, 5);
    assert.equal(quote.buyerFeeAmount, buyerFee);
    assert.equal(quote.merchantFeeAmount, merchantFee);
    assert.equal(quote.customerPaidProviderFeeMessage, mixed.customerPaidProviderFeeMessage);
    assert.deepEqual(body, before);
  }
  assert.throws(() => parseQuote(mixed), /final payable quote/);
});

test("incomplete, inconsistent and wrong-currency contextual quotes cannot become payment confirmations", () => {
  for (const patch of [
    { commerceSubtotalAmount: undefined },
    { buyerFeeAmount: undefined },
    { buyerFeeAmount: -1 },
    { merchantFeeAmount: 1 },
    { productFeeApplicationMode: "INHERIT" },
    { totalToPay: 105 },
    { netAmount: 100 },
    { grossAmount: 100 },
    { totalToPayCurrency: "CDF" },
    { feesCurrency: "EUR" },
    { netAmountCurrency: "EUR" },
    { buyerFeeAmount: NaN },
    { commerceSubtotalAmount: 100.001 },
  ])
    assert.throws(() => parseCommerceQuote({ ...mixed, ...patch }, "USD"));
  assert.throws(() =>
    parseCommerceQuote(
      { fees: 5, feesCurrency: "USD", totalToPay: 105, totalToPayCurrency: "USD" },
      "USD",
    ),
  );
});

test("contextual quotes use exact POST routes and omit generated fee hints, payment details and idempotency keys", () => {
  const contexts = [
    {
      context: { kind: "ORDER", reference: "CO-12", accessToken: "token&scope=order" },
      path: "/customer-api/commerce/orders/CO-12/payments/quote?accessToken=token%26scope%3Dorder",
    },
    {
      context: { kind: "ORDER", reference: "CO-12", storeId: 4 },
      path: "/customer-api/commerce/stores/4/pos/orders/CO-12/payments/quote",
    },
    {
      context: { kind: "CHECKOUT", checkoutId: 12, accessToken: "checkout-token" },
      path: "/customer-api/commerce/checkouts/12/payments/quote?accessToken=checkout-token",
    },
  ] as const;
  for (const { context, path } of contexts) {
    const quoted = commerceQuoteRequest(context, selection);
    assert.equal(quoted.path, path);
    assert.equal(quoted.init.method, "POST");
    assert.equal(quoted.init.cache, "no-store");
    assert.deepEqual(JSON.parse(quoted.init.body), {
      paymentMethod: { id: 22, currency: "USD", networkId: 7 },
    });
  }
  const sale = {
    items: [{ productId: 12, quantity: 1 }],
    billingCurrency: "USD",
    paymentCurrency: "USD",
    paymentMode: "FONDEKA",
    paymentStatus: "PAID",
  } as const;
  const quoted = commerceQuoteRequest(
    { kind: "POS_SALE", storeId: 4, sale: { ...sale, items: [...sale.items] } },
    selection,
  );
  assert.equal(quoted.path, "/customer-api/commerce/stores/4/pos/payments/quote");
  assert.deepEqual(JSON.parse(quoted.init.body), {
    sale,
    payment: { paymentMethod: { id: 22, currency: "USD", networkId: 7 } },
  });
  assert.doesNotMatch(quoted.init.body, /idempotencyKey|feeApplicationMode|accountRef/);
  assert.deepEqual(commercePaymentSelection(selection), {
    id: 22,
    currency: "USD",
    networkId: 7,
    accountRef: selection.accountRef,
  });
  assert.throws(() =>
    commerceQuoteRequest({ kind: "ORDER", reference: "../bad", storeId: 4 }, selection),
  );
  assert.throws(() => commerceQuoteRequest({ kind: "ORDER", reference: "CO-12" }, selection));
  assert.throws(() =>
    commerceQuoteRequest(
      {
        kind: "POS_SALE",
        storeId: 4,
        sale: { ...sale, items: [...sale.items], paymentCurrency: "CDF" },
      },
      selection,
    ),
  );
});

test("the gateway exposes only authenticated contextual quote POSTs and preserves the backend breakdown with no-store", async () => {
  const routes = [
    "customer-api/commerce/orders/CO-12/payments/quote",
    "customer-api/commerce/checkouts/12/payments/quote",
    "customer-api/commerce/stores/4/pos/payments/quote",
    "customer-api/commerce/stores/4/pos/orders/CO-12/payments/quote",
  ];
  for (const path of routes) {
    assert.equal(allowedProxyRoute(path, "POST"), true);
    for (const method of ["GET", "PUT", "PATCH", "DELETE"])
      assert.equal(allowedProxyRoute(path, method), false);
    assert.equal(allowedProxyRoute(path + "/extra", "POST"), false);
  }
  for (const path of [
    "public/commerce/orders/CO-12/payments/quote",
    "customer-api/commerce/stores/other/pos/payments/quote",
    "customer-api/commerce/checkouts/abc/payments/quote",
    "admin-api/commerce/orders/CO-12/payments/quote",
  ])
    assert.equal(allowedProxyRoute(path, "POST"), false);
  const previousFetch = globalThis.fetch;
  const previousBase = process.env.FONDEKA_API_BASE_URL;
  process.env.FONDEKA_API_BASE_URL = "https://backend.example";
  const body = JSON.stringify({ paymentMethod: { id: 22, currency: "USD" } });
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(
      String(url),
      "https://backend.example/customer-api/commerce/orders/CO-12/payments/quote?accessToken=order-token",
    );
    assert.equal(init?.body, body);
    assert.equal(init?.method, "POST");
    assert.equal(init?.cache, "no-store");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("Authorization"), "Bearer customer.token.signature");
    assert.equal(headers.get("X-Device-Session"), "verified-device");
    return Response.json(mixed);
  };
  const url =
    "http://localhost:4200/api/backend/customer-api/commerce/orders/CO-12/payments/quote?accessToken=order-token";
  const params = { params: Promise.resolve({ path: routes[0].split("/") }) };
  try {
    assert.equal((await POST(new NextRequest(url, { method: "POST", body }), params)).status, 401);
    assert.equal(calls, 0);
    const response = await POST(
      new NextRequest(url, {
        method: "POST",
        body,
        headers: {
          Authorization: "Bearer customer.token.signature",
          Origin: "http://localhost:4200",
          "X-Device-Session": "verified-device",
        },
      }),
      params,
    );
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), mixed);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.FONDEKA_API_BASE_URL;
    else process.env.FONDEKA_API_BASE_URL = previousBase;
  }
});

test("product edits preserve omitted overrides, explicit null resets them, and POS order snapshots stay unchanged", async () => {
  resetDemo();
  const write = (path: string, method: string, body: object) =>
    demoRequest<Product>(path, { method, body: JSON.stringify(body) });
  const fields = {
    name: "Consultation",
    priceAmount: 100,
    priceCurrency: "USD",
    type: "SERVICE",
    status: "ACTIVE",
  };
  const legacy = await write("/customer-api/commerce/stores/1/products", "POST", fields);
  assert.equal(legacy.feeApplicationMode, undefined);
  for (const mode of ["EXCLUSIVE", "INCLUSIVE"] as const) {
    const configured = await write(`/customer-api/commerce/products/${legacy.id}`, "PATCH", {
      ...fields,
      feeApplicationMode: mode,
    });
    assert.equal(configured.feeApplicationMode, mode);
    assert.equal(
      (await write(`/customer-api/commerce/products/${legacy.id}`, "PATCH", fields))
        .feeApplicationMode,
      mode,
    );
  }
  const sale: PosInput = {
    items: [{ productId: legacy.id, quantity: 1 }],
    billingCurrency: "USD",
    paymentCurrency: "USD",
    paymentMode: "FONDEKA",
    paymentStatus: "PAID",
  };
  const before = await demoRequest<Page<Order>>("/customer-api/commerce/stores/1/orders");
  const preview = commerceQuoteRequest({ kind: "POS_SALE", storeId: 1, sale }, selection);
  const quote = parseCommerceQuote(await demoRequest(preview.path, preview.init), "USD");
  assert.equal(quote.productFeeApplicationMode, "INCLUSIVE");
  assert.equal(
    (await demoRequest<Page<Order>>("/customer-api/commerce/stores/1/orders")).totalElements,
    before.totalElements,
  );
  const order = await demoRequest<Order>("/customer-api/commerce/stores/1/pos/orders", {
    method: "POST",
    body: JSON.stringify(sale),
  });
  assert.equal(order.items?.[0].feeApplicationMode, "INCLUSIVE");
  await write(`/customer-api/commerce/products/${legacy.id}`, "PATCH", {
    ...fields,
    feeApplicationMode: null,
  });
  assert.equal(
    (
      await demoRequest<Page<Product>>("/customer-api/commerce/stores/1/products?size=100")
    ).content.find((item) => item.id === legacy.id)?.feeApplicationMode,
    null,
  );
  const existing = commerceQuoteRequest(
    { kind: "ORDER", reference: order.reference, storeId: 1 },
    selection,
  );
  assert.equal(
    parseCommerceQuote(await demoRequest(existing.path, existing.init), "USD")
      .productFeeApplicationMode,
    "INCLUSIVE",
  );
  assert.equal(
    parseCommerceQuote(await demoRequest(preview.path, preview.init), "USD")
      .productFeeApplicationMode,
    "LEGACY",
  );
});

test("buyer receipts preserve an explicit zero instead of showing the seller fee, while older payloads retain fallback totals", () => {
  const order: Order = {
    id: 1,
    storeId: 1,
    reference: "CO-1",
    channel: "POS",
    status: "PAID",
    totalAmount: 100,
    totalCurrency: "USD",
    paymentAmount: 100,
    paymentCurrency: "USD",
    feeAmount: 5,
    feeCurrency: "USD",
    createdAt: "2026-10-31T12:00:00Z",
  };
  assert.equal(orderBuyerFee(order), 5);
  assert.match(receiptText(order), /Fees added to buyer total: \$5\.00/);
  const inclusive = {
    ...order,
    commerceSubtotalAmount: 100,
    buyerFeeAmount: 0,
    merchantFeeAmount: 5,
  };
  assert.equal(orderBuyerFee(inclusive), 0);
  assert.match(
    receiptText(inclusive),
    /Product subtotal: \$100\.00\nFees added to buyer total: \$0\.00\nTotal: \$100\.00/,
  );
  const mixedOrder = {
    ...inclusive,
    buyerFeeAmount: 2.5,
    merchantFeeAmount: 2.5,
    paymentAmount: 102.5,
  };
  assert.match(receiptText(mixedOrder), /Fees added to buyer total: \$2\.50\nTotal: \$102\.50/);
  assert.match(receiptText(mixedOrder, "fr"), /Frais ajoutés au total/);
  assert.match(receiptText({ ...order, paymentAmount: 105 }), /Total: \$100\.00/);
});
