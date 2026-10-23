import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessDecision,
  accessPath,
  billingLabel,
  buildSelection,
  businessDestination,
  canAfford,
  methodKey,
  needsBusinessToolsRecovery,
  normalizeMethods,
  parseAccess,
  parseQuote,
  quotePath,
  recoveryPrefix,
  subscriptionsPath,
  type BusinessToolsAccess,
  type BusinessToolsPurchase,
  type PaymentSelection,
  type ReviewedQuote,
} from "../src/lib/business-tools";
import {
  BusinessToolsClient,
  clearBusinessToolsRecovery,
  mayMountOwnerData,
} from "../src/lib/business-tools-client";
import { tokenCustomerScope } from "../src/lib/session-scope";

const purchaseId = "6f6041df-85ea-47ee-9ee4-1f01f4097ef0";
const selection: PaymentSelection = {
  id: 12,
  fiatWalletId: 56,
  currency: "USD",
  feeApplicationMode: "EXCLUSIVE",
};
const access = (patch: Partial<BusinessToolsAccess> = {}): BusinessToolsAccess => ({
  accessGranted: false,
  status: "INACTIVE",
  validFrom: null,
  validUntil: null,
  plan: {
    code: "SERVER_PLAN",
    name: "Business Tools",
    billingMode: "ONE_TIME",
    amount: 25,
    currency: "USD",
    purchasesEnabled: true,
    version: 3,
  },
  pendingPurchase: null,
  pricing: { planAmount: 25, legacyCreditAmount: 0, amountDue: 25, currency: "USD" },
  ...patch,
});
const quote = (): ReviewedQuote => ({
  value: { fees: 0.5, feesCurrency: "USD", totalToPay: 25.5, totalToPayCurrency: "USD" },
  selection: JSON.stringify(selection),
  planCode: "SERVER_PLAN",
  planVersion: 3,
  planAmount: 25,
  planCurrency: "USD",
  pricing: access().pricing,
  receivedAt: 1000,
});
const purchase = (
  status: BusinessToolsPurchase["status"],
  state = access(),
  id: string | null = purchaseId,
): BusinessToolsPurchase => ({
  id,
  status,
  paymentTransactionId: id ? 789 : null,
  accessGranted: state.accessGranted,
  access: state,
  failureCode: null,
  failureMessage: null,
});
function storage(): Storage {
  const target: Record<string, unknown> = {};
  Object.defineProperties(target, {
    getItem: { value: (key: string) => target[key] ?? null },
    setItem: {
      value: (key: string, value: string) => {
        target[key] = value;
      },
      writable: true,
    },
    removeItem: {
      value: (key: string) => {
        delete target[key];
      },
    },
  });
  return target as unknown as Storage;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function client(
  transport: (path: string, init?: RequestInit) => Promise<unknown>,
  options: {
    accountKey?: string;
    store?: Storage;
    onGranted?: () => void;
    uuid?: () => string;
    now?: () => number;
  } = {},
) {
  return new BusinessToolsClient({
    accountKey: options.accountKey ?? "customer-a",
    storage: options.store ?? storage(),
    request: transport,
    onGranted: options.onGranted ?? (() => {}),
    now: options.now ?? (() => 1000),
    uuid: options.uuid ?? (() => purchaseId),
  });
}

test("backend access wins over history, status, lifetime dates and unavailable sales", () => {
  const granted = access({
    accessGranted: true,
    status: "ACTIVE",
    plan: { ...access().plan, amount: 0, purchasesEnabled: false },
  });
  assert.equal(accessDecision(granted), "granted");
  assert.equal(accessDecision(access({ status: "ACTIVE" })), "purchase");
  const pending = access({
    pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: null },
    plan: { ...access().plan, purchasesEnabled: false },
  });
  assert.equal(accessDecision(pending), "pending");
  assert.equal(accessDecision(access({ plan: { ...access().plan, amount: 0 } })), "review");
  assert.equal(billingLabel("ONE_TIME", "fr"), "Paiement unique");
  assert.equal(billingLabel("MONTHLY"), "Monthly access");
});
test("the exact unconfigured response is unavailable and starts no payment requests", async () => {
  const unconfigured = access({
    plan: {
      code: "BUSINESS_TOOLS_LIFETIME",
      name: "Outils Business",
      billingMode: "ONE_TIME",
      amount: 0,
      currency: "USD",
      purchasesEnabled: false,
      version: 0,
    },
    pricing: { planAmount: 0, legacyCreditAmount: 0, amountDue: 0, currency: "USD" },
  });
  const calls: string[] = [];
  const subject = client(async (path) => {
    calls.push(path);
    return unconfigured;
  });
  await subject.enter("/developers");
  assert.equal(accessDecision(parseAccess(unconfigured)), "unavailable");
  assert.deepEqual(calls, [accessPath]);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
});
test("new purchases use the backend offer and quote without submitting a price or a store credit", async () => {
  const configured = access({
    plan: { ...access().plan, amount: 10 },
    pricing: { planAmount: 10, legacyCreditAmount: 0, amountDue: 10, currency: "USD" },
  });
  assert.equal(accessDecision(configured), "purchase");
  const reviewed = {
    ...quote(),
    planAmount: 10,
    pricing: configured.pricing,
    value: { fees: 0.5, feesCurrency: "USD", totalToPay: 10.5, totalToPayCurrency: "USD" },
  };
  let body: Record<string, unknown> | undefined;
  const subject = client(async (path, init) => {
    if (path === accessPath) return configured;
    body = JSON.parse(String(init?.body));
    return purchase("PENDING", configured);
  });
  await subject.enter("/stores");
  await subject.purchase(selection, reviewed);
  assert.deepEqual(Object.keys(body!).sort(), ["idempotencyKey", "paymentMethod", "planCode"]);
  assert.equal(
    new URL(quotePath(selection), "https://portal.invalid").searchParams.get("amount"),
    "0",
  );
  const changedPrice = client(async () => ({
    ...configured,
    pricing: { ...configured.pricing, amountDue: 12 },
  }));
  await changedPrice.enter("/stores");
  await assert.rejects(changedPrice.purchase(selection, reviewed), /Refresh/);
});
test("recognized paid-store lifetime access opens tools without a top-up, including unconfigured sales", async () => {
  for (const available of [true, false]) {
    const granted = access({
      accessGranted: true,
      status: "ACTIVE",
      validFrom: null,
      validUntil: null,
      plan: { ...access().plan, amount: available ? 10 : 0, purchasesEnabled: available },
      pricing: {
        planAmount: available ? 10 : 0,
        legacyCreditAmount: 0,
        amountDue: 0,
        currency: "USD",
      },
    });
    const calls: string[] = [];
    const subject = client(async (path) => {
      calls.push(path);
      return granted;
    });
    await subject.enter("/stores");
    assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), true);
    assert.deepEqual(calls, [accessPath]);
    await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  }
});
test("an obsolete partial-credit offer refreshes once for recognition and never starts a new top-up", async () => {
  const obsolete = access({
    plan: { ...access().plan, amount: 10 },
    pricing: { planAmount: 10, legacyCreditAmount: 4, amountDue: 6, currency: "USD" },
  });
  let reads = 0;
  const subject = client(async (path) => {
    assert.equal(path, accessPath);
    reads++;
    return obsolete;
  });
  await subject.enter("/stores");
  assert.equal(reads, 2);
  assert.equal(accessDecision(subject.getSnapshot().access!), "review");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  await subject.reload();
  assert.equal(reads, 3);
});
test("a completed historical credit-review purchase stays recoverable and never offers another charge", async () => {
  const saved = storage();
  const reviewing = purchase("COMPLETED");
  reviewing.failureCode = "BUSINESS_TOOLS_LEGACY_CREDIT_UNAVAILABLE";
  saved.setItem(recoveryPrefix + "customer-a", JSON.stringify({ purchaseId }));
  const calls: string[] = [];
  const subject = client(
    async (path, init) => {
      assert.notEqual(init?.method, "POST");
      calls.push(path);
      return path === accessPath ? access() : reviewing;
    },
    { store: saved },
  );
  await subject.enter("/developers");
  assert.equal(subject.getSnapshot().purchase?.failureCode, reviewing.failureCode);
  assert.equal(subject.getSnapshot().accessIssue, true);
  await subject.startAgain();
  assert.equal(subject.getSnapshot().purchase?.id, purchaseId);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  await subject.checkStatus();
  assert.equal(calls.filter((path) => path === `${subscriptionsPath}/${purchaseId}`).length, 2);
});
test("zero due without access refreshes only once and never unlocks or submits a purchase", async () => {
  const review = access({
    status: "ACTIVE",
    pricing: { planAmount: 25, legacyCreditAmount: 25, amountDue: 0, currency: "USD" },
  });
  let reads = 0;
  const subject = client(async (path) => {
    assert.equal(path, accessPath);
    reads++;
    return review;
  });
  await subject.enter("/pos");
  assert.equal(reads, 2);
  assert.equal(accessDecision(subject.getSnapshot().access!), "review");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), false);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  await subject.reload();
  assert.equal(reads, 3); // Explicit refresh is one read, not an automatic loop.
  const recognized = client(async () =>
    ++reads === 4 ? review : access({ accessGranted: true, pricing: review.pricing }),
  );
  await recognized.enter("/stores");
  assert.equal(mayMountOwnerData(recognized.getSnapshot(), "/stores", true), true);
});
test("pending purchase pricing may differ from today's offer and still resumes before disabled sales", async () => {
  const pending = access({
    plan: { ...access().plan, amount: 30, currency: "EUR", purchasesEnabled: false },
    pricing: { planAmount: 10, legacyCreditAmount: 4, amountDue: 6, currency: "USD" },
    pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: null },
  });
  const subject = client(async (path) => {
    assert.equal(path, accessPath);
    return pending;
  });
  await subject.enter("/developers");
  assert.equal(accessDecision(subject.getSnapshot().access!), "pending");
  assert.equal(subject.getSnapshot().purchase?.paymentTransactionId, null);
  assert.deepEqual(subject.getSnapshot().purchase?.access.pricing, pending.pricing);
});
test("missing or nonnumeric pricing fails rather than offering a guessed purchase", () => {
  assert.throws(() => parseAccess({ ...access(), pricing: undefined }), /invalid/);
  assert.throws(
    () => parseAccess({ ...access(), pricing: { ...access().pricing, amountDue: "6" } }),
    /invalid/,
  );
  assert.throws(
    () => parseAccess({ ...access(), pricing: { ...access().pricing, legacyCreditAmount: -1 } }),
    /invalid/,
  );
});
test("payment discovery preserves distinct wallets and supports both response versions", () => {
  const usd = {
    id: 12,
    type: "BALANCE" as const,
    name: "Fondeka",
    fiatWalletId: 56,
    currency: "USD",
    balance: 25,
    walletEnabled: true,
  };
  const cdf = { ...usd, fiatWalletId: 57, currency: "CDF", balance: 100_000 };
  const response = normalizeMethods({
    paymentMethods: [usd, cdf, { id: 99, type: "CREDIT" }, { id: 100, type: "AIRTIME" }],
    ui: { showCountrySelector: false },
  });
  assert.equal(response.paymentMethods.length, 2);
  assert.equal(response.ui?.showCountrySelector, false);
  assert.equal(normalizeMethods([usd, cdf]).paymentMethods.length, 2);
  assert.notEqual(methodKey(usd), methodKey(cdf));
  assert.deepEqual(buildSelection(cdf, "CDF"), {
    id: 12,
    currency: "CDF",
    fiatWalletId: 57,
    feeApplicationMode: "EXCLUSIVE",
  });
  assert.throws(() => buildSelection(cdf, "USD"), /wallet/);
  assert.throws(() => buildSelection({ ...usd, fiatWalletId: null }, "USD"), /wallet/);
  assert.equal(canAfford(usd, quote().value), false); // Base price is covered, fees are not.
  const path = new URL(quotePath(buildSelection(cdf, "CDF")), "https://portal.invalid");
  assert.equal(path.searchParams.get("action"), "BUSINESS_TOOLS_ACCESS");
  assert.equal(path.searchParams.get("amount"), "0");
  assert.equal(path.searchParams.get("fiatWalletId"), "57");
  assert.equal(path.searchParams.get("paymentCurrency"), "CDF");
  assert.equal(path.searchParams.get("feeApplicationMode"), "EXCLUSIVE");
  assert.throws(
    () => parseQuote({ fees: 0, feesCurrency: "USD", totalToPay: 0, totalToPayCurrency: "USD" }),
    /unavailable/,
  );
});
test("method-specific selection uses returned IDs and never adds wallet fields to external payments", () => {
  assert.deepEqual(
    buildSelection(
      { id: 4, name: "Mobile", type: "MOBILE_MONEY", currency: "CDF" },
      "CDF",
      " +243123456789 ",
    ),
    { id: 4, currency: "CDF", accountRef: "+243123456789", feeApplicationMode: "EXCLUSIVE" },
  );
  assert.deepEqual(buildSelection({ id: 5, name: "USDT", type: "CRYPTO" }, "USD", "", 8), {
    id: 5,
    currency: "USD",
    networkId: 8,
    feeApplicationMode: "EXCLUSIVE",
  });
  assert.deepEqual(buildSelection({ id: 6, name: "Bank", type: "BANK", currency: "EUR" }, "EUR"), {
    id: 6,
    currency: "EUR",
    feeApplicationMode: "EXCLUSIVE",
  });
  assert.throws(() => buildSelection({ id: 5, name: "USDT", type: "CRYPTO" }, "USD"), /network/);
});
test("owner data stays unmounted until account access is known and shares the grant between tools", async () => {
  const wait = deferred<unknown>();
  const calls: string[] = [];
  const subject = client(async (path) => {
    calls.push(path);
    return wait.promise;
  });
  const opening = subject.enter("/stores/42");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores/42", true), false);
  assert.deepEqual(calls, [accessPath]);
  wait.resolve(access({ accessGranted: true }));
  await opening;
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores/42", true), true);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), true);
  const unavailable = client(async () => {
    throw new Error("404 contract not deployed");
  });
  await unavailable.enter("/developers");
  assert.match(unavailable.getSnapshot().error!, /404/);
  assert.equal(unavailable.getSnapshot().access, undefined);
  assert.equal(mayMountOwnerData(unavailable.getSnapshot(), "/developers", true), false);
});
test("admin or migration grants open tools without a payment request", async () => {
  const calls: string[] = [];
  let refreshed = 0;
  const subject = client(
    async (path) => {
      calls.push(path);
      return access({ accessGranted: true, plan: { ...access().plan, purchasesEnabled: false } });
    },
    { onGranted: () => refreshed++ },
  );
  await subject.enter("/developers");
  assert.equal(subject.getSnapshot().access?.accessGranted, true);
  assert.equal(subject.getSnapshot().purchase, undefined);
  assert.deepEqual(calls, [accessPath]);
  assert.equal(refreshed, 1);
});
test("workspace startup reads once and menu/deep-link navigation immediately reuses account access", async () => {
  let reads = 0;
  let grants = 0;
  const subject = client(
    async (path) => {
      assert.equal(path, accessPath);
      reads++;
      return access({ accessGranted: true });
    },
    { onGranted: () => grants++ },
  );
  await subject.ensureAccess();
  for (const destination of [
    "/overview",
    "/stores",
    "/stores/42?tab=products",
    "/pos?store=42",
    "/payment-requests?request=7",
    "/developers",
    "/stores",
  ]) {
    const entering = subject.enter(destination);
    assert.equal(subject.getSnapshot().loading, false);
    assert.equal(mayMountOwnerData(subject.getSnapshot(), destination, true), true);
    await entering;
  }
  assert.equal(reads, 1);
  assert.equal(grants, 1);
});
test("idle resume retains verified access, coalesces focus checks and locks only after confirmed revocation", async () => {
  let now = 1000;
  let reads = 0;
  const wait = deferred<unknown>();
  const subject = client(
    async () => (++reads === 1 ? access({ accessGranted: true }) : wait.promise),
    { now: () => now },
  );
  await subject.ensureAccess();
  await subject.revalidate();
  assert.equal(reads, 1);
  now += 60_001;
  const refresh = subject.revalidate();
  assert.equal(subject.revalidate(), refresh);
  assert.equal(subject.getSnapshot().loading, false);
  assert.equal(subject.getSnapshot().refreshing, true);
  await subject.enter("/stores");
  assert.equal(reads, 2);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), true);
  wait.resolve(access({ status: "EXPIRED" }));
  await refresh;
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
});
test("a temporary background access error does not hide an already loaded workspace", async () => {
  let now = 1000;
  let reads = 0;
  const subject = client(
    async () => {
      if (++reads === 1) return access({ accessGranted: true });
      throw new Error("Offline");
    },
    { now: () => now },
  );
  await subject.ensureAccess();
  now += 60_001;
  await subject.revalidate();
  assert.equal(subject.getSnapshot().error, undefined);
  assert.equal(subject.getSnapshot().refreshError, "Offline");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), true);
});
test("a protected-operation denial supersedes an in-flight background grant", async () => {
  let now = 1000;
  let reads = 0;
  const background = deferred<unknown>();
  const denied = deferred<unknown>();
  const subject = client(
    async () => {
      reads++;
      if (reads === 1) return access({ accessGranted: true });
      return reads === 2 ? background.promise : denied.promise;
    },
    { now: () => now },
  );
  await subject.ensureAccess();
  now += 60_001;
  const refresh = subject.revalidate();
  const check = subject.enter("/stores", true);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
  denied.resolve(access());
  await check;
  background.resolve(access({ accessGranted: true }));
  await refresh;
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
});
test("explicit access refresh still blocks owner reads and honors backend expiry", async () => {
  const wait = deferred<unknown>();
  let reads = 0;
  const subject = client(async () =>
    ++reads === 1 ? access({ accessGranted: true }) : wait.promise,
  );
  await subject.enter("/stores");
  const refreshing = subject.reload();
  assert.equal(reads, 2);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
  const navigating = subject.enter("/pos");
  assert.equal(reads, 2); // Navigation shares the in-flight refresh.
  wait.resolve(access({ status: "EXPIRED" }));
  await Promise.all([refreshing, navigating]);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), false);
});
test("startup and concurrent deep links share one request without opening an unknown account", async () => {
  const wait = deferred<unknown>();
  let reads = 0;
  const subject = client(async () => {
    reads++;
    return wait.promise;
  });
  const startup = subject.ensureAccess();
  const one = subject.enter("/stores");
  const two = subject.enter("/developers");
  assert.equal(reads, 1);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), false);
  wait.resolve(access({ accessGranted: true }));
  await Promise.all([startup, one, two]);
  assert.equal(subject.getSnapshot().destination, "/developers");
  assert.equal(reads, 1);
});
test("inactive accounts reuse their status and pending purchase; access errors are retried rather than cached as unpaid", async () => {
  let reads = 0;
  const pending = client(async () => {
    reads++;
    return access({
      pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: 7 },
    });
  });
  await pending.ensureAccess();
  await pending.enter("/pos");
  await pending.enter("/stores");
  assert.equal(reads, 1);
  assert.equal(pending.getSnapshot().purchase?.id, purchaseId);
  assert.equal(mayMountOwnerData(pending.getSnapshot(), "/stores", true), false);
  let attempts = 0;
  const recovering = client(async () => {
    if (++attempts === 1) throw new Error("Offline");
    return access({ accessGranted: true });
  });
  await recovering.ensureAccess();
  assert.match(recovering.getSnapshot().error!, /Offline/);
  assert.equal(recovering.getSnapshot().access, undefined);
  await recovering.enter("/developers");
  assert.equal(attempts, 2);
  assert.equal(mayMountOwnerData(recovering.getSnapshot(), "/developers", true), true);
});
test("an unavailable saved purchase lookup stays in recovery across repeated access checks", async () => {
  const saved = storage();
  saved.setItem(recoveryPrefix + "customer-a", JSON.stringify({ purchaseId }));
  let lookups = 0;
  const subject = client(
    async (path, init) => {
      assert.notEqual(init?.method, "POST");
      if (path === accessPath) return access();
      assert.equal(path, `${subscriptionsPath}/${purchaseId}`);
      lookups++;
      throw new Error("404 purchase lookup unavailable");
    },
    { store: saved },
  );
  await subject.enter("/developers");
  await subject.reload();
  assert.equal(lookups, 2);
  assert.match(subject.getSnapshot().error!, /404/);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  assert.equal(JSON.parse(saved.getItem(recoveryPrefix + "customer-a")!).purchaseId, purchaseId);
});
test("balance completion refreshes authoritative access before opening the selected tool", async () => {
  const wait = deferred<unknown>();
  let reads = 0;
  const subject = client(async (path, init) => {
    if (path === accessPath) return ++reads === 1 ? access() : wait.promise;
    assert.equal(init?.method, "POST");
    return purchase("COMPLETED", access({ accessGranted: true }));
  });
  await subject.enter("/payment-requests");
  const paying = subject.purchase(selection, quote());
  await Promise.resolve();
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/payment-requests", true), false);
  wait.resolve(access({ accessGranted: true }));
  await paying;
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/payment-requests", true), true);
});
test("a definitive validation rejection permits correction only after checking access", async () => {
  let reads = 0;
  let posts = 0;
  const subject = client(async (path) => {
    if (path === accessPath) {
      reads++;
      return access();
    }
    posts++;
    throw Object.assign(new Error("The payer phone is invalid"), { status: 400 });
  });
  await subject.enter("/stores");
  await subject.purchase(selection, quote());
  assert.equal(reads, 2);
  assert.equal(posts, 1);
  assert.equal(subject.getSnapshot().intent, undefined);
  assert.equal(subject.getSnapshot().uncertain, false);
  assert.match(subject.getSnapshot().submissionError!, /phone/);
});
test("only a confirmed terminal result permits a new purchase intent", async () => {
  const bodies: string[] = [];
  let serial = 0;
  const subject = client(
    async (path, init) => {
      if (path === accessPath) return access();
      bodies.push(String(init?.body));
      return purchase("FAILED");
    },
    { uuid: () => `${purchaseId}-${++serial}` },
  );
  await subject.enter("/pos");
  await subject.purchase(selection, quote());
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  await subject.startAgain();
  await subject.purchase(selection, quote());
  assert.equal(bodies.length, 2);
  assert.notEqual(JSON.parse(bodies[0]).idempotencyKey, JSON.parse(bodies[1]).idempotencyKey);
});
test("malformed response identifiers and malformed token subjects are rejected", () => {
  assert.throws(
    () =>
      parseAccess(
        access({
          pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: -1 },
        }),
      ),
    /invalid/,
  );
  const token = (value: unknown) =>
    `header.${Buffer.from(JSON.stringify(value)).toString("base64url")}.signature`;
  assert.equal(tokenCustomerScope(token({ sub: "customer-a" })), "customer-a");
  for (const value of ["not-a-token", token({ sub: 42 }), token({})])
    assert.equal(tokenCustomerScope(value), undefined);
});
test("an existing pending purchase resumes even while purchases are disabled; status reads are sequential", async () => {
  const pending = access({
    plan: { ...access().plan, purchasesEnabled: false },
    pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: 789 },
  });
  let statusCalls = 0;
  const wait = deferred<unknown>();
  const subject = client(async (path) => {
    if (path === accessPath) return pending;
    assert.equal(path, `${subscriptionsPath}/${purchaseId}`);
    statusCalls++;
    return wait.promise;
  });
  await subject.enter("/pos");
  const first = subject.checkStatus();
  const second = subject.checkStatus();
  assert.equal(first, second);
  assert.equal(statusCalls, 1);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), false);
  wait.resolve(purchase("PENDING", pending));
  await first;
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
});
test("granted access wins over a pending payment while retaining its status identifiers", async () => {
  const active = access({
    accessGranted: true,
    status: "ACTIVE",
    validUntil: null,
    plan: { ...access().plan, amount: 0, purchasesEnabled: false },
    pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: 789 },
    pricing: { planAmount: 10, legacyCreditAmount: 0, amountDue: 0, currency: "USD" },
  });
  const calls: string[] = [];
  const subject = client(async (path) => {
    calls.push(path);
    return active;
  });
  await subject.enter("/pos");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), true);
  assert.equal(accessDecision(subject.getSnapshot().access!), "granted");
  assert.deepEqual(subject.getSnapshot().access?.pendingPurchase, active.pendingPurchase);
  assert.equal(subject.getSnapshot().intent, undefined);
  assert.deepEqual(calls, [accessPath]);
  await assert.rejects(subject.purchase(selection, quote()), /existing access/);
});
test("COMPLETED without access stays locked, and failed payment with an independent grant opens tools", async () => {
  for (const [paymentStatus, granted] of [
    ["COMPLETED", false],
    ["FAILED", true],
  ] as const) {
    let reads = 0;
    const subject = client(async (path) => {
      if (path === accessPath) return ++reads === 1 ? access() : access({ accessGranted: granted });
      return purchase(paymentStatus);
    });
    await subject.enter("/stores");
    await subject.purchase(selection, quote());
    assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), granted);
    assert.equal(subject.getSnapshot().accessIssue, !granted);
    if (!granted) await assert.rejects(subject.purchase(selection, quote()), /existing access/);
  }
});
test("double submission and a lost response recover an existing payment without a second POST", async () => {
  const wait = deferred<unknown>();
  const pending = access({
    pendingPurchase: { id: purchaseId, status: "PENDING", paymentTransactionId: 789 },
  });
  let posts = 0;
  let reads = 0;
  const subject = client(async (path, init) => {
    if (init?.method === "POST") {
      posts++;
      return wait.promise;
    }
    assert.equal(path, accessPath);
    return ++reads === 1 ? access() : pending;
  });
  await subject.enter("/payment-requests?new=1");
  const first = subject.purchase(selection, quote());
  await subject.purchase(selection, quote());
  assert.equal(posts, 1);
  wait.resolve(Promise.reject(new Error("timeout")));
  await first;
  assert.equal(posts, 1);
  assert.equal(subject.getSnapshot().purchase?.id, purchaseId);
  assert.equal(subject.getSnapshot().intent, undefined);
  assert.equal(subject.getSnapshot().destination, "/payment-requests?new=1");
});
test("reload and explicit uncertain retry reuse exactly the original POST body and key", async () => {
  const saved = storage();
  const bodies: string[] = [];
  let granted = false;
  const transport = async (path: string, init?: RequestInit) => {
    if (path === accessPath) return access({ accessGranted: granted });
    assert.equal(path, subscriptionsPath);
    bodies.push(String(init?.body));
    if (bodies.length === 1) throw new Error("connection dropped");
    granted = true;
    return purchase("COMPLETED", access({ accessGranted: true }), null);
  };
  const first = client(transport, { store: saved });
  await first.enter("/pos?store=42");
  await first.purchase(selection, quote());
  assert.equal(bodies.length, 1);
  assert.equal(first.getSnapshot().uncertain, true);
  first.dispose();
  const reopened = client(transport, { store: saved });
  await reopened.enter("/pos?store=42");
  assert.equal(bodies.length, 1); // Restoration only reads.
  await assert.rejects(
    reopened.purchase({ ...selection, fiatWalletId: 999 }, quote()),
    /existing access/,
  );
  await reopened.retryIntent();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(JSON.parse(bodies[0]).planCode, "SERVER_PLAN");
  assert.equal(mayMountOwnerData(reopened.getSnapshot(), "/pos", true), true);
  assert.equal(saved.getItem(recoveryPrefix + "customer-a"), null);
});
test("a 409 preserves the intent and never generates a replacement payment automatically", async () => {
  let posts = 0;
  const subject = client(async (path) => {
    if (path === accessPath) return access();
    posts++;
    throw new Error("409 idempotency conflict");
  });
  await subject.enter("/developers");
  await subject.purchase(selection, quote());
  assert.equal(posts, 1);
  const original = subject.getSnapshot().intent?.idempotencyKey;
  assert.match(subject.getSnapshot().submissionError!, /409/);
  await subject.retryIntent();
  assert.equal(posts, 2);
  assert.equal(subject.getSnapshot().intent?.idempotencyKey, original);
});
test("revocation supersedes older in-flight access and an owned-resource denial never asks an active account to pay", async () => {
  const stale = deferred<unknown>();
  let reads = 0;
  const subject = client(async () =>
    ++reads === 1 ? stale.promise : access({ status: "REVOKED" }),
  );
  const first = subject.enter("/developers");
  await subject.reload(true);
  stale.resolve(access({ accessGranted: true }));
  await first;
  assert.equal(subject.getSnapshot().access?.accessGranted, false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), false);
  const active = client(async () => access({ accessGranted: true }));
  await active.enter("/stores/42", true);
  assert.equal(active.getSnapshot().resourceUnavailable, true);
  assert.equal(mayMountOwnerData(active.getSnapshot(), "/stores/42", true), false);
  await assert.rejects(active.purchase(selection, quote()), /existing access/);
  await active.enter("/developers");
  assert.equal(mayMountOwnerData(active.getSnapshot(), "/developers", true), true);
  assert.equal(mayMountOwnerData(active.getSnapshot(), "/stores/42", true), false);
});
test("session changes clear recovery and ignore late responses from the previous account", async () => {
  const saved = storage();
  saved.setItem(recoveryPrefix + "customer-a", "{}");
  saved.setItem(recoveryPrefix + "customer-b", "{}");
  saved.setItem("device-proof", "keep");
  clearBusinessToolsRecovery(saved, "customer-b");
  assert.equal(saved.getItem(recoveryPrefix + "customer-a"), null);
  assert.equal(saved.getItem("device-proof"), "keep");
  const wait = deferred<unknown>();
  let grants = 0;
  const old = client(async () => wait.promise, { onGranted: () => grants++ });
  const opening = old.enter("/stores");
  old.dispose();
  wait.resolve(access({ accessGranted: true }));
  await opening;
  assert.equal(grants, 0);
  const fresh = client(async () => access());
  assert.equal(fresh.getSnapshot().access, undefined);
  assert.equal(mayMountOwnerData(fresh.getSnapshot(), "/stores", true), false);
  clearBusinessToolsRecovery(saved);
  assert.equal(saved.getItem(recoveryPrefix + "customer-b"), null);
});
test("old quotes, unavailable pricing and storage failures cannot submit a purchase", async () => {
  let posts = 0;
  const subject = client(async (path) => {
    if (path === accessPath) return access();
    posts++;
  });
  await subject.enter("/stores");
  await assert.rejects(subject.purchase(selection, { ...quote(), receivedAt: -60_000 }), /Refresh/);
  await assert.rejects(subject.purchase({ ...selection, fiatWalletId: 99 }, quote()), /Refresh/);
  assert.equal(posts, 0);
  const locked = client(async () =>
    access({ plan: { ...access().plan, amount: 0, purchasesEnabled: false } }),
  );
  await locked.enter("/pos");
  await assert.rejects(locked.purchase(selection, quote()), /existing access/);
  const blockedStorage = storage();
  blockedStorage.setItem = () => {
    throw new Error("storage disabled");
  };
  const unavailableStorage = client(async () => access(), { store: blockedStorage });
  await unavailableStorage.enter("/pos");
  await assert.rejects(unavailableStorage.purchase(selection, quote()), /session storage/);
});
test("only known internal destinations and the specific owner-access denial enter recovery", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/login",
    "/settings",
    "/market",
    "/stores/42/../../login",
    "/checkout",
    "/p/invoice",
  ])
    assert.equal(businessDestination(value), undefined);
  assert.equal(businessDestination("/pos?store=42&returnTo=https://evil.example"), "/pos?store=42");
  assert.equal(
    needsBusinessToolsRecovery(
      403,
      "BUSINESS_TOOLS_ACCESS_REQUIRED",
      "/customer-api/commerce/stores/42",
    ),
    true,
  );
  for (const [status, code, path] of [
    [401, "DEVICE_SESSION_REQUIRED", "/customer-api/businesses"],
    [403, "FORBIDDEN", "/customer-api/commerce/stores/42"],
    [403, "BUSINESS_TOOLS_ACCESS_REQUIRED", accessPath],
    [403, "BUSINESS_TOOLS_ACCESS_REQUIRED", "/customer-api/transactions/123"],
  ] as const)
    assert.equal(needsBusinessToolsRecovery(status, code, path), false);
});
