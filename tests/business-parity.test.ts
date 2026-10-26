import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedProxyRoute } from "../src/lib/proxy-policy";
import {
  canUseStore,
  isStoreOwner,
  storeTabAllowed,
  storeUpdateInput,
  storeEditInput,
  validateCashSale,
  reportQuery,
  normalizePayerFields,
} from "../src/lib/commerce";
import {
  businessDestination,
  quotePath,
  paymentMethodsPath,
  collectionMethods,
  type PaymentMethod,
} from "../src/lib/business-tools";
import { toolLinkDestination } from "../src/lib/business-tools-ui";
import {
  cacheQuery,
  cachedQuery,
  isQueryFresh,
  clearQueryCache,
  queryCacheGeneration,
  invalidateQueryPaths,
  queryRevision,
} from "../src/lib/query-cache";
import { currencyChoices, currencyPresentations } from "../src/lib/currency-choices";
import { receiptHtml } from "../src/lib/receipt";
import { uiText } from "../src/lib/ui-copy";
import { demoRequest, resetDemo } from "../src/lib/demo";
import type {
  Store,
  PosInput,
  PaymentRequest,
  RequestPayment,
  Page,
  Customer,
  Order,
  SalesReport,
} from "../src/lib/types";
const store: Store = {
  id: 7,
  name: "Store",
  slug: "store",
  defaultCurrency: "CDF",
  status: "ACTIVE",
  accessType: "OWNER",
  logoUrl: "https://assets.example/logo.png",
  bannerUrl: "https://assets.example/banner.png",
  videoUrl: "https://assets.example/commerce-store-videos/clip.mp4",
  videoDurationSeconds: 20,
  contactEmail: "owner@example.test",
  instagramUrl: "https://instagram.com/demo",
  visibility: "PRIVATE",
};
test("owner routes expose only the contract methods, not arbitrary customer/admin financial operations", () => {
  const routes: [string, string[]][] = [
    ["commerce/stores/7", ["GET", "PATCH", "DELETE"]],
    ["payment_requests/9", ["GET", "PUT", "DELETE"]],
    ["payment_requests/9/collect", ["POST"]],
    ["payment_requests/9/payments", ["GET"]],
    ["payment_requests/type-settings", ["GET"]],
    ["commerce/stores/7/customers", ["GET", "POST"]],
    ["commerce/stores/7/customers/3", ["GET", "PATCH", "DELETE"]],
    ["commerce/stores/7/customers/3/orders", ["GET"]],
    ["commerce/stores/7/staff/4", ["GET", "PATCH", "DELETE"]],
    ["commerce/stores/7/staff", ["GET", "POST"]],
    ["commerce/stores/7/reports/sales", ["GET"]],
    ["commerce/stores/7/pos/products/search", ["GET"]],
    ["storage/presign", ["POST"]],
    ["storage/object", ["DELETE"]],
    ["commerce/stores/7/products/digital-assets/presign", ["POST"]],
    ["commerce/orders/CO-123/payments/start", ["POST"]],
    ["fiat-wallets/currencies", ["GET"]],
  ];
  for (const [path, verbs] of routes)
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"])
      assert.equal(
        allowedProxyRoute("customer-api/" + path, method),
        verbs.includes(method),
        method + " " + path,
      );
  for (const path of [
    "commerce/products/7/delete",
    "commerce/stores/7/refund",
    "commerce/stores/7/reports/revenue-export",
    "commerce/stores/7/staff/4/grant-admin",
    "accounts/7",
    "transactions/8/refund",
  ])
    assert.equal(allowedProxyRoute("customer-api/" + path, "POST"), false);
  assert.equal(allowedProxyRoute("admin-api/commerce/stores", "GET"), false);
});
test("payer keys follow the shared lowercase vocabulary and reject duplicate normalized names", () => {
  assert.deepEqual(
    normalizePayerFields([{ key: " Full Name ", label: " Full name ", required: true }]),
    [{ key: "full_name", label: "Full name", required: true }],
  );
  assert.throws(
    () =>
      normalizePayerFields([
        { key: "Full Name", label: "Name", required: false },
        { key: "full_name", label: "Again", required: false },
      ]),
    /unique/,
  );
});
test("targeted invalidation refreshes an affected store without erasing another store; cleared accounts reject late cache writes", () => {
  clearQueryCache();
  const generation = queryCacheGeneration();
  cacheQuery(
    "account:/customer-api/commerce/stores/7",
    { id: 7 },
    Date.now(),
    generation,
    "/customer-api/commerce/stores/7",
  );
  cacheQuery(
    "account:/customer-api/commerce/stores/70",
    { id: 70 },
    Date.now(),
    generation,
    "/customer-api/commerce/stores/70",
  );
  const other = queryRevision("/customer-api/commerce/stores/70");
  invalidateQueryPaths(["/customer-api/commerce/stores/7"]);
  assert.equal(cachedQuery("account:/customer-api/commerce/stores/7"), undefined);
  assert.deepEqual(cachedQuery("account:/customer-api/commerce/stores/70"), { id: 70 });
  assert.equal(queryRevision("/customer-api/commerce/stores/70"), other);
  clearQueryCache();
  cacheQuery("previous-account:late", {}, Date.now(), generation);
  assert.equal(cachedQuery("previous-account:late"), undefined);
});
test("store permissions decide visible tabs and prevent staff from receiving owner controls", () => {
  for (const permission of ["POS", "REPORTS", "PRODUCTS", "SALES", "CUSTOMERS"])
    assert.equal(canUseStore(store, permission), true);
  const staff = { ...store, accessType: "STAFF", staffPermissions: ["POS", "CUSTOMERS"] };
  assert.equal(canUseStore(staff, "POS"), true);
  assert.equal(storeTabAllowed(staff, "customers"), true);
  assert.equal(storeTabAllowed(staff, "products"), false);
  assert.equal(storeTabAllowed(staff, "reports"), false);
  assert.equal(storeTabAllowed(staff, "staff"), false);
  assert.equal(storeTabAllowed(staff, "settings"), false);
  assert.equal(isStoreOwner({ ...store, accessType: undefined }), false);
  assert.equal(canUseStore({ ...staff, staffPermissions: ["pos", "customers"] }, "POS"), true);
});
test("Overview and Business remain open entry areas while selected tools require access resolution", () => {
  assert.equal(businessDestination("/business"), "/business");
  assert.equal(toolLinkDestination("/business"), undefined);
  assert.equal(toolLinkDestination("/overview"), undefined);
  for (const destination of ["/stores", "/pos", "/payment-requests", "/developers"])
    assert.equal(toolLinkDestination(destination), destination);
});
test("collection discovery and quotes retain request identity and crypto networks; POS excludes balance only in its own flow", () => {
  const context = {
    action: "PAY_REQUEST",
    amount: 25,
    currency: "CDF",
    paymentRequestId: 42,
    paymentRequestCode: "code_42",
    feeMode: "INCLUSIVE" as const,
  };
  const methods = new URL(paymentMethodsPath(context, "CD"), "https://portal.test");
  assert.equal(methods.searchParams.get("paymentRequestId"), "42");
  assert.equal(methods.searchParams.get("paymentRequestCode"), "code_42");
  const quote = new URL(
    quotePath({ id: 3, networkId: 7, currency: "CDF", feeApplicationMode: "EXCLUSIVE" }, context),
    "https://portal.test",
  );
  for (const [key, value] of Object.entries({
    paymentRequestId: "42",
    paymentRequestCode: "code_42",
    networkId: "7",
    amount: "25",
    currency: "CDF",
    feeApplicationMode: "INCLUSIVE",
  }))
    assert.equal(quote.searchParams.get(key), value);
  assert.throws(() => paymentMethodsPath({ action: "PAY_REQUEST" }));
  const returned = [
    { id: 1, type: "BALANCE", currency: "CDF" },
    { id: 2, type: "MOBILE_MONEY", currency: "CDF" },
  ] as PaymentMethod[];
  assert.equal(collectionMethods(returned, "BUSINESS_TOOLS_ACCESS").length, 2);
  assert.deepEqual(
    collectionMethods(returned, "COMMERCE_CHECKOUT_PAYMENT").map((m) => m.id),
    [2],
  );
});
test("publishing a store retains every setting applied by the backend full-settings PATCH", () => {
  const body = storeUpdateInput(store, { visibility: "PUBLIC", status: "ACTIVE" });
  for (const key of [
    "logoUrl",
    "bannerUrl",
    "videoUrl",
    "videoDurationSeconds",
    "contactEmail",
    "instagramUrl",
  ] as const)
    assert.equal(body[key], store[key]);
  assert.equal(body.visibility, "PUBLIC");
  assert.equal("id" in body, false);
  assert.equal("paymentMethod" in body, false);
  const current = {
    ...store,
    bannerUrl: "https://assets.example/new-banner.png",
    contactEmail: "updated@example.test",
  };
  const edited = storeEditInput(store, current, {
    name: "New name",
    description: store.description || "",
    defaultCurrency: store.defaultCurrency,
    countryCode: store.countryCode || "",
    bannerUrl: store.bannerUrl,
    contactEmail: store.contactEmail,
  });
  assert.equal(edited.name, "New name");
  assert.equal(edited.bannerUrl, current.bannerUrl);
  assert.equal(edited.contactEmail, current.contactEmail);
});
test("localized render text uses an explicit hydration locale and retains unknown safe backend copy", () => {
  assert.equal(uiText("Loading", "en"), "Loading");
  assert.equal(uiText("Loading", "fr"), "Chargement");
  assert.equal(uiText("Safe backend message", "fr"), "Safe backend message");
});
test("cash sale validation separates paid, partial and credit without inventing a successful payment", () => {
  const base: PosInput = {
    items: [{ productId: 1, quantity: 1 }],
    billingCurrency: "CDF",
    paymentCurrency: "CDF",
    paymentMode: "CASH",
    paymentStatus: "PAID",
  };
  assert.doesNotThrow(() => validateCashSale(base, 10000));
  assert.throws(() => validateCashSale({ ...base, paymentStatus: "ON_CREDIT" }, 10000), /customer/);
  const future = "2099-10-23";
  assert.doesNotThrow(() =>
    validateCashSale(
      { ...base, paymentStatus: "ON_CREDIT", customerId: 3, paymentDueDate: future, amountPaid: 0 },
      10000,
    ),
  );
  assert.throws(
    () =>
      validateCashSale(
        {
          ...base,
          paymentStatus: "PARTIALLY_PAID",
          customerId: 3,
          paymentDueDate: future,
          amountPaid: 10000,
        },
        10000,
      ),
    /less than/,
  );
  assert.doesNotThrow(() =>
    validateCashSale(
      {
        ...base,
        paymentStatus: "PARTIALLY_PAID",
        customerId: 3,
        paymentDueDate: future,
        amountPaid: 4000,
      },
      10000,
    ),
  );
  assert.throws(
    () =>
      validateCashSale(
        { ...base, paymentStatus: "ON_CREDIT", customerId: 3, paymentDueDate: "2000-01-01" },
        10000,
      ),
    /due date/,
  );
});
test("report dates and currency stay server inputs, and discovered currencies exclude disabled products", () => {
  assert.equal(
    reportQuery("custom", "CDF", "2026-01-01", "2026-01-31"),
    "currency=CDF&from=2026-01-01&to=2026-01-31",
  );
  assert.throws(() => reportQuery("custom", "USD", "2026-02-01", "2026-01-01"));
  assert.deepEqual(
    currencyChoices(
      {
        currencies: [
          { currency: "CDF", walletEnabled: true },
          { currency: "EUR", enabled: false },
          { currency: "USD", active: true },
        ],
      },
      ["CDF"],
    ),
    ["CDF", "USD"],
  );
});
test("account/language/version query keys stay isolated; idle data becomes stale without disappearing", () => {
  clearQueryCache();
  cacheQuery("account-A:/stores:en:1", { name: "A" }, 1000);
  assert.equal(cachedQuery("account-B:/stores:en:1"), undefined);
  assert.equal(cachedQuery("account-A:/stores:fr:1"), undefined);
  assert.equal(cachedQuery("account-A:/stores:en:2"), undefined);
  assert.deepEqual(cachedQuery("account-A:/stores:en:1"), { name: "A" });
  assert.equal(isQueryFresh("account-A:/stores:en:1", "", 1001), true);
  assert.equal(isQueryFresh("account-A:/stores:en:1", "", 121001), false);
  assert.deepEqual(cachedQuery("account-A:/stores:en:1"), { name: "A" });
  cacheQuery("account-A:/stores:en:1", {}, 2000);
  clearQueryCache();
  assert.equal(cachedQuery("account-A:/stores:en:1"), undefined);
});
test("known owner deep links retain their selections and discard external return targets", () => {
  const path = businessDestination(
    "/stores/7?tab=customers&customer=3&sale=CO-123&page=2&returnTo=https://foreign.example",
  );
  assert.equal(path, "/stores/7?tab=customers&page=2&customer=3&sale=CO-123");
  const api = businessDestination(
    "/developers?business=7&environment=SANDBOX&apiReference=SBXabc&api_currency=CDF&api_orderReference=Order%2642&api_clientReference=old-bookmark&returnTo=//foreign.example",
  );
  assert.match(api!, /environment=SANDBOX/);
  assert.match(api!, /api_currency=CDF/);
  assert.match(api!, /api_orderReference=Order%2642/);
  assert.match(api!, /api_clientReference=old-bookmark/);
  assert.doesNotMatch(api!, /returnTo/);
});
test("receipt printing escapes all merchant/customer content and preserves normal currency units", () => {
  const order: Order = {
    id: 1,
    reference: "CO-123",
    storeId: 7,
    storeName: "<script>alert(1)</script>",
    buyerName: "<img src=x onerror=alert(1)>",
    channel: "POS",
    status: "PAID",
    totalAmount: 10000,
    totalCurrency: "CDF",
    createdAt: "2026-10-23T10:00:00Z",
    amountPaid: 4000,
    amountPaidCurrency: "CDF",
    balanceDue: 6000,
    balanceDueCurrency: "CDF",
  };
  const html = receiptHtml(order, "fr");
  assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /10.?000/);
  assert.match(html, /Solde dû/);
});
test("demo owner workflows create/edit/read requests and customers without affecting real APIs", async () => {
  const memory = new Map<string, string>();
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
    },
  });
  try {
    resetDemo();
    const created = await demoRequest<PaymentRequest>("/customer-api/payment_requests", {
      method: "POST",
      body: JSON.stringify({
        type: "DONATION",
        title: "Training",
        amount: null,
        currency: "USD",
        feeInclusion: "ABSORBED",
        description: "Support",
        payerFields: [{ key: "name", label: "Name", required: true }],
      }),
    });
    const read = await demoRequest<PaymentRequest>(`/customer-api/payment_requests/${created.id}`);
    assert.equal(read.type, "DONATION");
    assert.equal(read.amount, null);
    const body = JSON.stringify({ idempotencyKey: "one-intent", amount: 4, paymentMethodId: 2 });
    await demoRequest(`/customer-api/payment_requests/${created.id}/collect`, {
      method: "POST",
      body,
    });
    await demoRequest(`/customer-api/payment_requests/${created.id}/collect`, {
      method: "POST",
      body,
    });
    const payments = await demoRequest<Page<RequestPayment>>(
      `/customer-api/payment_requests/${created.id}/payments?page=0&size=20`,
    );
    assert.equal(payments.totalElements, 1);
    assert.equal(payments.content[0].amount, 4);
    await assert.rejects(
      () =>
        demoRequest("/customer-api/payment_requests/" + created.id + "/collect", {
          method: "POST",
          body: JSON.stringify({ idempotencyKey: "one-intent", amount: 8, paymentMethodId: 2 }),
        }),
      { status: 409 },
    );
    await assert.rejects(() =>
      demoRequest(`/customer-api/payment_requests/${created.id}`, { method: "DELETE" }),
    );
    const c = await demoRequest<Customer>("/customer-api/commerce/stores/1/customers", {
      method: "POST",
      body: JSON.stringify({ name: "Customer", email: "c@example.test" }),
    });
    await demoRequest(`/customer-api/commerce/stores/1/customers/${c.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated" }),
    });
    const updated = await demoRequest<Customer>(
      `/customer-api/commerce/stores/1/customers/${c.id}`,
    );
    assert.equal(updated.name, "Updated");
    const before = await demoRequest<SalesReport>(
      "/customer-api/commerce/stores/1/reports/sales?period=today&currency=USD",
    );
    const sale = await demoRequest<Order>("/customer-api/commerce/stores/1/pos/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productId: 1, quantity: 1 }],
        billingCurrency: "USD",
        paymentCurrency: "USD",
        paymentMode: "CASH",
        paymentStatus: "PARTIALLY_PAID",
        amountPaid: 1,
        customerId: c.id,
        paymentDueDate: "2099-01-01",
      }),
    });
    const today = await demoRequest<SalesReport>(
      "/customer-api/commerce/stores/1/reports/sales?period=today&currency=USD",
    );
    assert.equal(today.totalSalesAmount, before.totalSalesAmount + sale.totalAmount);
    assert.equal(today.amountPaid, before.amountPaid + 1);
    assert.equal(today.balanceDue, before.balanceDue + sale.totalAmount - 1);
    assert.equal(today.partialOrderCount, before.partialOrderCount + 1);
    const past = await demoRequest<SalesReport>(
      "/customer-api/commerce/stores/1/reports/sales?from=2000-01-01&to=2000-01-31&currency=USD",
    );
    assert.equal(past.orderCount, 0);
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
  }
});

test("wallet currency media reuses catalog logos and names without deriving balances or assigning an ambiguous country", () => {
  const metadata = currencyPresentations({
    content: [
      {
        currency: "USD",
        displayName: "US Dollar",
        logoUrl: "https://flagcdn.com/w80/us.png",
        countryCodes: ["US"],
        balance: 999999,
      },
      { currency: "XAF", countryCodes: ["CM", "GA"], logoUrl: null },
      { currency: "CDF", logoUrl: 123, displayName: null },
      { currency: "invalid", logoUrl: "https://foreign.example/icon.png" },
      "EUR",
    ],
  });
  assert.deepEqual(metadata.get("USD"), {
    displayName: "US Dollar",
    logoUrl: "https://flagcdn.com/w80/us.png",
    countryCode: "US",
  });
  assert.equal(metadata.get("XAF")?.countryCode, undefined);
  assert.equal(metadata.get("CDF")?.logoUrl, undefined);
  assert.equal(metadata.size, 3);
  assert.equal(currencyPresentations(null).size, 0);
});
