import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseStore,
  canViewCustomerOrders,
  canManageStore,
  storeTabAllowed,
} from "../src/lib/commerce";
import {
  businessDestination,
  hasToolAccess,
  parseAccess,
  type BusinessToolsAccess,
} from "../src/lib/business-tools";
import {
  sharedStoresPath,
  storeOwnerAccessRequired,
  storeWorkspaceId,
  storeVisible,
} from "../src/lib/shared-stores";
import { posOrderPath, posOrderTransaction, posPaymentBody } from "../src/lib/pos-payment";
import { allowedProxyRoute } from "../src/lib/proxy-policy";
import {
  cacheQuery,
  cachedQuery,
  clearQueryCache,
  fetchQuery,
  forgetCommerceQueries,
  queryRevision,
} from "../src/lib/query-cache";
import type { Order, Store } from "../src/lib/types";

const staff: Store = {
  id: 74,
  name: "Shared counter",
  slug: "shared-counter",
  defaultCurrency: "USD",
  status: "ACTIVE",
  accessType: "STAFF",
  shared: true,
  ownerAccountId: 100,
  businessId: 42,
  staffPermissions: ["POS"],
  capabilities: {
    canViewStore: true,
    canUsePos: true,
    canManageProducts: false,
    canViewSales: false,
    canManageCustomers: false,
    canViewReports: false,
    canViewCustomerOrderHistory: false,
    canManageStore: false,
    canManageStaff: false,
    canManageSettlements: false,
  },
};
const access: BusinessToolsAccess = {
  accessGranted: false,
  status: "INACTIVE",
  validFrom: null,
  validUntil: null,
  plan: {
    code: "RETURNED_BUNDLE",
    name: "Business Tools",
    billingMode: "ONE_TIME",
    amount: 10,
    currency: "USD",
    purchasesEnabled: true,
    version: 1,
  },
  pendingPurchase: null,
  pricing: {
    planAmount: 10,
    legacyCreditAmount: 0,
    amountDue: 10,
    currency: "USD",
    priceSource: "BASE",
  },
};

test("assigned-store discovery does not grant personal tools or replace the compatible bundle contract", () => {
  assert.equal(parseAccess(access).pricingMode, undefined);
  const parsed = parseAccess({
    ...access,
    commerceAccess: {
      canCreateOwnStore: false,
      hasSharedStores: true,
      sharedStoreCount: 2,
      sharedStoresEndpoint: "/customer-api/commerce/stores/shared",
    },
  });
  for (const tool of ["POS", "ONLINE_STORES", "API", "PAYMENT_REQUESTS"] as const)
    assert.equal(hasToolAccess(parsed, tool), false);
  assert.equal(parsed.plan.code, "RETURNED_BUNDLE");
  for (const invalid of [
    null,
    {},
    {
      canCreateOwnStore: false,
      hasSharedStores: true,
      sharedStoreCount: -1,
      sharedStoresEndpoint: "https://foreign.example",
    },
  ])
    assert.throws(() => parseAccess({ ...access, commerceAccess: invalid }));
});
test("shared POS requests filter on the server with exact routes, bounded pagination and safe navigation", () => {
  assert.equal(
    sharedStoresPath(2, "POS"),
    "/customer-api/commerce/stores/shared?page=2&size=20&permission=POS",
  );
  assert.equal(sharedStoresPath(), "/customer-api/commerce/stores/shared?page=0&size=20");
  const invalidQueries: [number, string | undefined, number][] = [
    [-1, undefined, 20],
    [0, "SETTLEMENTS", 20],
    [0, undefined, 101],
  ];
  for (const args of invalidQueries) assert.throws(() => sharedStoresPath(...args));
  assert.equal(allowedProxyRoute("customer-api/commerce/stores/shared", "GET"), true);
  for (const method of ["POST", "PATCH", "DELETE"])
    assert.equal(allowedProxyRoute("customer-api/commerce/stores/shared", method), false);
  assert.equal(
    businessDestination(
      "/stores?view=shared&mode=pos&page=2&ownerAccountId=100&return=https://foreign.example",
    ),
    "/stores?mode=pos&view=shared&page=2",
  );
  assert.equal(storeWorkspaceId("/stores/74/pos"), "74");
  assert.equal(storeWorkspaceId("/developers?business=42"), undefined);
});
test("server capabilities control assigned-store actions while legacy customer and sales permissions remain compatible", () => {
  assert.equal(storeVisible(staff), true);
  assert.equal(canUseStore(staff, "POS"), true);
  for (const permission of ["PRODUCTS", "SALES", "CUSTOMERS", "REPORTS"])
    assert.equal(canUseStore({ ...staff, staffPermissions: [permission] }, permission), false);
  for (const tab of ["products", "sales", "customers", "reports", "settings", "staff"])
    assert.equal(storeTabAllowed(staff, tab), false);
  const legacy = { ...staff, capabilities: undefined, staffPermissions: ["CUSTOMERS"] };
  assert.equal(canUseStore(legacy, "CUSTOMERS"), true);
  assert.equal(canViewCustomerOrders(legacy), true);
  assert.equal(canViewCustomerOrders({ ...legacy, staffPermissions: ["SALES"] }), false);
  assert.equal(
    canViewCustomerOrders({ ...legacy, staffPermissions: ["CUSTOMERS", "SALES"] }),
    true,
  );
  assert.equal(
    canViewCustomerOrders({
      ...legacy,
      capabilities: { ...staff.capabilities!, canViewCustomerOrderHistory: false },
    }),
    false,
  );
  for (const capability of ["canManageStore", "canManageStaff"] as const)
    assert.equal(
      canManageStore(
        { ...staff, capabilities: { ...staff.capabilities!, [capability]: true } },
        capability,
      ),
      false,
    );
  assert.equal(canManageStore(legacy, "canManageSettlements"), false);
  assert.equal(
    canManageStore({ ...legacy, staffPermissions: ["SALES"] }, "canManageSettlements"),
    true,
  );
  assert.equal(
    canManageStore(
      { ...staff, capabilities: { ...staff.capabilities!, canManageSettlements: true } },
      "canManageSettlements",
    ),
    true,
  );
  assert.equal(canManageStore(staff, "canManageSettlements"), false);
  assert.equal(canUseStore({ ...staff, accessType: undefined }, "POS"), false);
  assert.equal(
    storeVisible({ ...staff, capabilities: { ...staff.capabilities!, canViewStore: false } }),
    false,
  );
});
test("owner activation metadata is explicit, store-scoped and supports both error envelopes", () => {
  const details = {
    paymentResponsibility: "STORE_OWNER",
    staffPaymentRequired: false,
    storeId: 74,
    ownerAccountId: 100,
    accessType: "STAFF",
  };
  assert.equal(storeOwnerAccessRequired({ access: details }), 74);
  assert.equal(storeOwnerAccessRequired({ details: { access: details } }), 74);
  for (const patch of [
    { staffPaymentRequired: true },
    { paymentResponsibility: "CUSTOMER" },
    { accessType: "OWNER" },
    { storeId: 0 },
    { storeId: "74" },
  ])
    assert.equal(storeOwnerAccessRequired({ access: { ...details, ...patch } }), undefined);
});
test("POS payment uses a store-scoped route and quote currency, preserving the explicit retry intent", () => {
  const path = posOrderPath(74, "CO123");
  assert.equal(path, "/customer-api/commerce/stores/74/pos/orders/CO123");
  assert.equal(allowedProxyRoute(path.slice(1), "GET"), true);
  assert.equal(allowedProxyRoute(path.slice(1) + "/payments/start", "POST"), true);
  assert.equal(allowedProxyRoute(path.slice(1) + "/payments/start", "GET"), false);
  assert.throws(() => posOrderPath(74, "../CO123"));
  assert.throws(() => posOrderPath(0, "CO123"));
  const selection = {
    id: 3,
    currency: "CDF",
    feeApplicationMode: "EXCLUSIVE" as const,
    accountRef: "+243000000000",
  };
  const body = posPaymentBody(selection, "original-pos-intent");
  assert.deepEqual(body, {
    paymentMethodId: 3,
    currency: "CDF",
    accountNumber: selection.accountRef,
    networkId: undefined,
    idempotencyKey: "original-pos-intent",
  });
  assert.deepEqual(posPaymentBody(selection, "original-pos-intent"), body);
  assert.equal(Object.hasOwn(body, "accessToken"), false);
  assert.throws(() => posPaymentBody({ ...selection, fiatWalletId: 5 }, "original-pos-intent"));
});
test("store-scoped polling exposes payment instructions without retaining buyer or delivery secrets", () => {
  const order: Order & Record<string, unknown> = {
    id: 1,
    storeId: 74,
    reference: "CO123",
    channel: "POS",
    status: "PENDING_PAYMENT",
    totalAmount: 10,
    totalCurrency: "USD",
    createdAt: "2026-10-29T12:00:00Z",
    paymentTransactionId: 8,
    paymentTransactionStatus: "PROCESSING",
    paymentTransactionReference: "TX123",
    paymentAmount: 10,
    paymentCurrency: "USD",
    cryptoDetails: { address: "test-instruction", exchangeRate: null },
    accessToken: "private-buyer-token",
    fulfillmentUrl: "private-delivery",
  };
  const transaction = posOrderTransaction(order, 74, "CO123");
  assert.equal(transaction.status, "PROCESSING");
  assert.equal(transaction.cryptoDetails?.address, "test-instruction");
  assert.doesNotMatch(
    JSON.stringify(transaction),
    /private-buyer-token|private-delivery|accessToken|fulfillment/,
  );
  for (const changed of [
    { storeId: 75 },
    { reference: "OTHER" },
    { channel: "STOREFRONT" },
    { paymentTransactionId: undefined },
  ])
    assert.throws(() => posOrderTransaction({ ...order, ...changed }, 74, "CO123"));
});
test("revocation evicts only the account's commerce cache without aborting/replaying the rejected read", async () => {
  clearQueryCache();
  const path = "/customer-api/commerce/stores/74";
  cacheQuery("a:secret", { private: true }, Date.now(), undefined, path + "/products");
  cacheQuery("b:secret", { private: true }, Date.now(), undefined, path + "/products");
  cacheQuery("a:other", { payment: true }, Date.now(), undefined, "/customer-api/payment_requests");
  const revision = queryRevision(path);
  let calls = 0;
  await assert.rejects(
    fetchQuery("a:store", "v", path, async () => {
      calls++;
      forgetCommerceQueries("a", path);
      throw Object.assign(new Error("Permission removed"), { status: 403 });
    }),
    /Permission removed/,
  );
  assert.equal(calls, 1);
  assert.equal(queryRevision(path), revision);
  assert.equal(cachedQuery("a:secret"), undefined);
  assert.deepEqual(cachedQuery("b:secret"), { private: true });
  assert.deepEqual(cachedQuery("a:other"), { payment: true });
  clearQueryCache();
});
