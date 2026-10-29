import { test } from "node:test";
import assert from "node:assert/strict";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type {
  ApiKey,
  ApiTransaction,
  Order,
  Page,
  Product,
  Quote,
  Staff,
  Store,
} from "../src/lib/types";

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
test("demo shared-store filtering and POS payment stay scoped to the assigned store", async () => {
  resetDemo();
  await demoRequest("/customer-api/commerce/stores/1", {
    method: "PATCH",
    body: JSON.stringify({ accessType: "STAFF", shared: true, staffPermissions: ["POS"] }),
  });
  const shared = await demoRequest<Page<Store>>(
    "/customer-api/commerce/stores/shared?page=0&size=1&permission=POS",
  );
  assert.equal(shared.totalElements, 1);
  assert.deepEqual(
    shared.content.map((store) => store.id),
    [1],
  );
  const products = await demoRequest<Page<Store>>(
    "/customer-api/commerce/stores/shared?permission=PRODUCTS",
  );
  assert.equal(products.totalElements, 0);
  const create = (paymentMode: string) =>
    demoRequest<Order>("/customer-api/commerce/stores/1/pos/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productId: 2, quantity: 1 }],
        billingCurrency: "USD",
        paymentCurrency: "USD",
        paymentMode,
        paymentStatus: "PAID",
        customerId: 1,
      }),
    });
  const order = await create("FONDEKA");
  assert.equal(order.accessToken, "demo-order-token");
  assert.equal(order.customerId, 1);
  const path = `/customer-api/commerce/stores/1/pos/orders/${order.reference}`;
  const payment = {
    method: "POST",
    body: JSON.stringify({
      paymentMethodId: 2,
      currency: "USD",
      idempotencyKey: "demo-staff-payment",
    }),
  };
  const paid = await demoRequest<Order>(path + "/payments/start", payment);
  assert.equal(paid.paymentTransactionStatus, "COMPLETED");
  assert.equal(paid.totalAmount, order.totalAmount);
  assert.equal(Object.hasOwn(paid, "accessToken"), false);
  assert.deepEqual(await demoRequest(path + "/payments/start", payment), paid);
  assert.deepEqual(await demoRequest(path), paid);
  const legacy = await demoRequest<Order>(
    `/customer-api/commerce/orders/${order.reference}?accessToken=${order.accessToken}`,
  );
  assert.equal(legacy.accessToken, order.accessToken);
  assert.equal(legacy.customerId, order.customerId);
  await assert.rejects(demoRequest(path.replace("stores/1", "stores/2")), /unavailable/);
  await assert.rejects(
    demoRequest(path + "/payments/start", {
      ...payment,
      body: JSON.stringify({ fiatWalletId: 1 }),
    }),
    /unavailable/,
  );
  const cash = await create("CASH");
  await assert.rejects(
    demoRequest(
      `/customer-api/commerce/stores/1/pos/orders/${cash.reference}/payments/start`,
      payment,
    ),
    /unavailable/,
  );
  resetDemo();
});
test("staff assignments are immediately active, preserve durable identity and do not treat owner reads as first entry", async () => {
  resetDemo();
  const path = "/customer-api/commerce/stores/1/staff";
  const create = (email: string, permissions: string[]) =>
    demoRequest<Staff>(path, { method: "POST", body: JSON.stringify({ email, permissions }) });
  const member = await create("staff@example.test", ["pos", "sales"]);
  assert.equal(member.status, "ACTIVE");
  assert.equal(member.acceptedAt, null);
  assert.deepEqual(member.permissions, ["POS", "SALES"]);
  assert.deepEqual(await demoRequest(`${path}/${member.id}`), member);
  assert.equal((await demoRequest<Page<Staff>>(path)).content[0].acceptedAt, null);
  const duplicate = await create("STAFF@example.test", ["customers"]);
  assert.equal(duplicate.id, member.id);
  assert.equal((await demoRequest<Page<Staff>>(path)).totalElements, 1);
  const updated = await demoRequest<Staff>(`${path}/${member.id}`, {
    method: "PATCH",
    body: JSON.stringify({ permissions: ["reports"] }),
  });
  assert.deepEqual(updated.permissions, ["REPORTS"]);
  assert.equal(updated.id, member.id);
  assert.equal(updated.email, member.email);
  assert.equal(updated.acceptedAt, null);
  assert.equal(await demoRequest(`${path}/${member.id}`, { method: "DELETE" }), undefined);
  for (const method of ["GET", "PATCH", "DELETE"])
    await assert.rejects(
      demoRequest(`${path}/${member.id}`, {
        method,
        ...(method === "PATCH" ? { body: JSON.stringify({ permissions: ["pos"] }) } : {}),
      }),
      (error: { status?: number; code?: string }) =>
        error.status === 404 && error.code === "NO_RESULT",
    );
  const regranted = await create("staff@example.test", ["pos"]);
  assert.equal(regranted.id, member.id);
  assert.equal(regranted.acceptedAt, member.acceptedAt);
  assert.equal(regranted.status, "ACTIVE");
  await assert.rejects(
    demoRequest(`/customer-api/commerce/stores/2/staff/${member.id}`),
    (error: { status?: number }) => error.status === 404,
  );
  resetDemo();
});
test("demo API history paginates and filters directions, exact references, and currencies", async () => {
  const first = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?page=0&size=10",
  );
  const second = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?page=1&size=10",
  );
  assert.equal(first.totalElements, 12);
  const reference = first.content[0].transaction.fondekaReference;
  const exact = await demoRequest<Page<ApiTransaction>>(
    `/customer-api/businesses/1/api-transactions?reference=${encodeURIComponent(reference)}`,
  );
  assert.equal(exact.content.length, 1);
  assert.equal(exact.content[0].transaction.fondekaReference, reference);
  for (const row of first.content) {
    assert.ok(Number.isInteger(row.apiKeyId));
    assert.equal(row.transaction.service, "BUSINESS_API");
    for (const removed of [
      "reference",
      "allFees",
      "businessId",
      "transactionId",
      "settlementAmount",
      "settlementNet",
      "refunded",
    ])
      assert.equal(Object.hasOwn(row.transaction, removed), false, removed);
  }
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
  assert.equal(Object.hasOwn(unresolved.transaction, "refunded"), false);
  assert.equal(unresolved.transaction.fee, 0.5);
});
