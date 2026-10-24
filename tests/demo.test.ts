import { test } from "node:test";
import assert from "node:assert/strict";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type { ApiKey, ApiTransaction, Order, Page, Product, Quote } from "../src/lib/types";

test("credential demo edits only an active owned key URL and keeps LIVE/SANDBOX metadata separate", async () => {
  resetDemo();
  const live = await demoRequest<ApiKey[]>("/customer-api/businesses/1/api-keys");
  const sandbox = await demoRequest<ApiKey[]>(
    "/customer-api/businesses/1/api-keys?environment=SANDBOX",
  );
  assert.deepEqual(
    live.map((key) => key.id),
    [1],
  );
  assert.deepEqual(
    sandbox.map((key) => key.id),
    [3],
  );
  const edited = await demoRequest<ApiKey>("/customer-api/businesses/1/api-keys/3/webhook", {
    method: "PATCH",
    body: JSON.stringify({ webhookUrl: " https://merchant.example:443/new " }),
  });
  assert.deepEqual(edited, { ...sandbox[0], webhookUrl: "https://merchant.example/new" });
  const changed = await demoRequest<ApiKey[]>(
    "/customer-api/businesses/1/api-keys?environment=SANDBOX",
  );
  assert.deepEqual(changed, [edited]);
  assert.deepEqual(await demoRequest("/customer-api/businesses/1/api-keys"), live);
  for (const path of [
    "/customer-api/businesses/1/api-keys/2/webhook",
    "/customer-api/businesses/2/api-keys/3/webhook",
  ])
    await assert.rejects(
      demoRequest(path, {
        method: "PATCH",
        body: JSON.stringify({ webhookUrl: "https://merchant.example/new" }),
      }),
      (error: { status?: number }) => error.status === 404,
    );
  await assert.rejects(
    demoRequest("/customer-api/businesses/1/api-keys/3/webhook", {
      method: "PATCH",
      body: JSON.stringify({ webhookUrl: "https://merchant.example/new", name: "Cannot rename" }),
    }),
    (error: { status?: number }) => error.status === 400,
  );
});

test("demo cash checkout quotes decimals correctly, records one order, and reduces tracked stock", async () => {
  resetDemo();
  const body = JSON.stringify({
    items: [{ productId: 2, quantity: 3 }],
    billingCurrency: "USD",
    paymentCurrency: "USD",
    paymentMode: "CASH",
    paymentStatus: "PAID",
  });
  const quote = await demoRequest<Quote>("/customer-api/commerce/stores/1/pos/orders/quote", {
    method: "POST",
    body,
  });
  assert.equal(quote.totalAmount, 37.5);
  const order = await demoRequest<Order>("/customer-api/commerce/stores/1/pos/orders", {
    method: "POST",
    body,
  });
  assert.equal(order.totalAmount, quote.totalAmount);
  assert.equal(order.posPaymentStatus, "PAID");
  const products = await demoRequest<Page<Product>>("/customer-api/commerce/stores/1/products");
  assert.equal(products.content.find((product) => product.id === 2)?.inventoryQuantity, 61);
  await assert.rejects(
    demoRequest("/customer-api/commerce/stores/1/pos/orders", {
      method: "POST",
      body: JSON.stringify({ items: [{ productId: 2, quantity: 999 }], billingCurrency: "USD" }),
    }),
    /stock/,
  );
});
test("demo API history paginates and filters directions, exact references, and currencies", async () => {
  const first = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?page=0&size=10",
  );
  const second = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?page=1&size=10",
  );
  assert.equal(first.totalElements, 12);
  assert.equal(second.content.length, 2);
  assert.notEqual(first.content[0].requestId, second.content[0].requestId);
  const filtered = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?action=BUSINESS_API_COLLECTION&currency=EUR",
  );
  assert.equal(filtered.content.length, 1);
  assert.equal(filtered.content[0].transaction.currency, "EUR");
  const unresolved = await demoRequest<ApiTransaction>(
    "/customer-api/businesses/1/api-transactions/TXDEMO8414",
  );
  assert.equal(unresolved.transaction.status, "PROCESSING");
  assert.equal(unresolved.transaction.refunded, false);
});
