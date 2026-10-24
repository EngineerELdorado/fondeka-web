import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accessForDestination,
  accessPath,
  businessToolCodes,
  effectivePurchaseAction,
  hasToolAccess,
  parseAccess,
  parsePurchase,
  paymentMethodsPath,
  quotePath,
  recoveryPrefix,
  subscriptionsPath,
  type BusinessTool,
  type BusinessToolAccess,
  type BusinessToolsAccess,
  type BusinessToolsPurchase,
  type PaymentSelection,
  type ReviewedQuote,
} from "../src/lib/business-tools";
import { BusinessToolsClient, mayMountOwnerData } from "../src/lib/business-tools-client";
import { mayContinueToTool } from "../src/lib/business-tools-ui";

const id = "6f6041df-85ea-47ee-9ee4-1f01f4097ef0";
const selection: PaymentSelection = {
  id: 12,
  currency: "USD",
  fiatWalletId: 56,
  feeApplicationMode: "EXCLUSIVE",
};
function offer(tool: BusinessTool | "BUNDLE", granted = false): BusinessToolAccess {
  const purchaseAction =
    tool === "BUNDLE" ? "BUSINESS_TOOLS_ACCESS" : (`BUSINESS_TOOLS_${tool}_ACCESS` as const);
  return {
    tool,
    purchaseAction,
    purchaseNotice: `Server notice: ${tool}`,
    pricingMode: "PER_TOOL",
    accessGranted: granted,
    status: granted ? "ACTIVE" : "INACTIVE",
    validFrom: null,
    validUntil: null,
    plan: {
      code: `RETURNED_${tool}`,
      name: tool,
      amount: 7,
      currency: "USD",
      billingMode: "ONE_TIME",
      version: 1,
      purchasesEnabled: true,
      tool,
      purchaseAction,
    },
    pricing: { planAmount: 7, legacyCreditAmount: 0, amountDue: granted ? 0 : 7, currency: "USD" },
    pendingPurchase: null,
  };
}
function account(
  grants: BusinessTool[] = [],
  pricingMode: "BUNDLE" | "PER_TOOL" = "PER_TOOL",
): BusinessToolsAccess {
  const bundle = { ...offer("BUNDLE", grants.length === 4), pricingMode };
  return {
    ...bundle,
    bundle,
    pricingMode,
    tools: businessToolCodes.map((tool) => ({
      ...offer(tool, grants.includes(tool)),
      pricingMode,
      ...(pricingMode === "BUNDLE"
        ? { plan: bundle.plan, purchaseAction: bundle.purchaseAction }
        : {}),
    })),
  };
}
function review(access: BusinessToolsAccess): ReviewedQuote {
  return {
    value: { fees: 0.2, feesCurrency: "USD", totalToPay: 7.2, totalToPayCurrency: "USD" },
    planCode: access.plan.code,
    planVersion: access.plan.version,
    planAmount: access.plan.amount,
    planCurrency: access.plan.currency,
    pricing: access.pricing,
    receivedAt: 1000,
    selection: JSON.stringify(selection),
  };
}
function payment(
  status: BusinessToolsPurchase["status"],
  access: BusinessToolsAccess,
  tool: BusinessToolsPurchase["tool"] = "POS",
): BusinessToolsPurchase {
  return {
    id,
    tool,
    status,
    paymentTransactionId: 789,
    accessGranted: tool === "BUNDLE" ? access.accessGranted : hasToolAccess(access, tool!),
    access,
    failureCode: null,
    failureMessage: null,
  };
}
function session() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
function client(
  request: (path: string, init?: RequestInit) => Promise<unknown>,
  storage = session(),
  onGranted = () => {},
) {
  return new BusinessToolsClient({
    accountKey: "owner",
    request,
    storage,
    now: () => 1000,
    uuid: () => id,
    onGranted,
  });
}

test("legacy bundle responses retain their existing action and all-tools gate", () => {
  const legacy: BusinessToolsAccess = { ...offer("BUNDLE") };
  delete legacy.pricingMode;
  delete legacy.purchaseAction;
  for (const destination of ["/payment-requests", "/stores", "/pos", "/developers"]) {
    const selected = accessForDestination(parseAccess(legacy), destination)!;
    assert.equal(selected.plan.code, "RETURNED_BUNDLE");
    assert.equal(selected.purchaseAction, "BUSINESS_TOOLS_ACCESS");
    assert.equal(selected.accessGranted, false);
  }
});
test("each card selects the server's independent plan, notice, method and quote action", () => {
  const root = parseAccess(account());
  for (const [destination, tool] of [
    ["/payment-requests", "PAYMENT_REQUESTS"],
    ["/stores", "ONLINE_STORES"],
    ["/stores/42/pos", "POS"],
    ["/developers/guides", "API"],
  ] as const) {
    const selected = accessForDestination(root, destination)!;
    assert.equal(selected.plan.code, `RETURNED_${tool}`);
    assert.equal(selected.purchaseNotice, `Server notice: ${tool}`);
    for (const path of [
      paymentMethodsPath({ action: selected.purchaseAction }, "CD"),
      quotePath(selection, { action: selected.purchaseAction }),
    ]) {
      assert.equal(
        new URL(path, "https://portal.invalid").searchParams.get("action"),
        `BUSINESS_TOOLS_${tool}_ACCESS`,
      );
    }
    assert.equal(
      new URL(
        quotePath(selection, { action: selected.purchaseAction }),
        "https://portal.invalid",
      ).searchParams.get("amount"),
      "0",
    );
  }
});
test("an individually paid tool remains accessible when the offered mode returns to BUNDLE", async () => {
  let reads = 0;
  const subject = client(async () => {
    reads++;
    return account(["API"], "BUNDLE");
  });
  await subject.enter("/developers");
  assert.equal(mayContinueToTool(subject.getSnapshot(), "/developers"), true);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/payment-requests", true), false);
  await subject.enter("/pos");
  assert.equal(subject.getSnapshot().access?.plan.code, "RETURNED_BUNDLE");
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), true);
  assert.equal(reads, 1);
});
test("POS access includes shared store setup/catalogue while store customers and staff require POS", async () => {
  const subject = client(async () => account(["POS"]));
  await subject.enter("/pos");
  for (const destination of [
    "/stores?mode=pos&new=1",
    "/stores/42?tab=products",
    "/stores/42/pos",
    "/stores/42?tab=customers",
  ])
    assert.equal(mayMountOwnerData(subject.getSnapshot(), destination, true), true, destination);
  assert.equal(hasToolAccess(subject.getSnapshot().accountAccess, "ONLINE_STORES"), false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores", true), false);
  await subject.enter("/stores");
  assert.equal(subject.getSnapshot().access?.tool, "ONLINE_STORES");
  assert.equal(subject.getSnapshot().access?.accessGranted, false);
  const stores = client(async () => account(["ONLINE_STORES"]));
  await stores.enter("/stores");
  assert.equal(mayMountOwnerData(stores.getSnapshot(), "/stores/42?tab=customers", true), false);
  assert.equal(mayMountOwnerData(stores.getSnapshot(), "/stores/42?tab=staff", true), false);
});
test("a publication denial uses the required Online Stores offer even on a shared POS route", async () => {
  const subject = client(async () => account(["POS"]));
  await subject.enter("/stores/42?tab=settings");
  await subject.enter("/stores/42?tab=settings", true, "ONLINE_STORES");
  assert.equal(subject.getSnapshot().access?.tool, "ONLINE_STORES");
  assert.equal(subject.getSnapshot().resourceUnavailable, false);
  assert.equal(mayContinueToTool(subject.getSnapshot(), "/stores/42?tab=settings"), false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), true);
  subject.dismissOffer();
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/stores/42?tab=settings", true), true);
});
test("a completed individual purchase reloads account access and opens only its granted scope", async () => {
  let granted = false;
  let body: Record<string, unknown> | undefined;
  let grants = 0;
  const subject = client(
    async (path, init) => {
      if (path === accessPath) return account(granted ? ["POS"] : []);
      assert.equal(path, subscriptionsPath);
      body = JSON.parse(String(init?.body));
      granted = true;
      return payment("COMPLETED", account(["POS"]));
    },
    session(),
    () => {
      grants++;
    },
  );
  await subject.enter("/pos");
  await subject.purchase(selection, review(subject.getSnapshot().access!));
  assert.deepEqual(Object.keys(body!).sort(), ["idempotencyKey", "paymentMethod", "planCode"]);
  assert.equal(body!.planCode, "RETURNED_POS");
  assert.equal(mayContinueToTool(subject.getSnapshot(), "/pos"), true);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/payment-requests", true), false);
  assert.equal(subject.getSnapshot().accountAccess?.accessGranted, false);
  assert.equal(grants, 1);
});
test("a purchase response alone never unlocks a tool when the main access read still denies it", async () => {
  const subject = client(async (path) =>
    path === accessPath ? account() : payment("COMPLETED", account(["POS"])),
  );
  await subject.enter("/pos");
  await subject.purchase(selection, review(subject.getSnapshot().access!));
  assert.equal(mayContinueToTool(subject.getSnapshot(), "/pos"), false);
  assert.equal(subject.getSnapshot().accessIssue, true);
  await subject.startAgain();
  assert.equal(subject.getSnapshot().purchase?.status, "COMPLETED");
  await assert.rejects(
    subject.purchase(selection, review(subject.getSnapshot().access!)),
    /existing access/,
  );
});
test("terminal failures and refunds do not grant individual tools or erase an independent grant", async () => {
  for (const status of ["FAILED", "CANCELLED", "REFUNDED"] as const) {
    const subject = client(async (path) =>
      path === accessPath ? account(["API"]) : payment(status, account(["API"])),
    );
    await subject.enter("/pos");
    await subject.purchase(selection, review(subject.getSnapshot().access!));
    assert.equal(mayContinueToTool(subject.getSnapshot(), "/pos"), false);
    assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), true);
    assert.equal(subject.getSnapshot().purchase?.status, status);
  }
});
test("a completed purchase for another tool cannot unlock the selected destination", async () => {
  let paid = false;
  const subject = client(async (path) => {
    if (path === accessPath) return account(paid ? ["API"] : []);
    paid = true;
    return payment("COMPLETED", account(["API"]), "API");
  });
  await subject.enter("/pos");
  await subject.purchase(selection, review(subject.getSnapshot().access!));
  assert.equal(mayContinueToTool(subject.getSnapshot(), "/pos"), false);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/developers", true), true);
  await subject.startAgain();
  assert.equal(subject.getSnapshot().purchase, undefined);
  assert.equal(subject.getSnapshot().access?.plan.code, "RETURNED_POS");
});
test("pending bundle recovery takes precedence and uses the accepted bundle action after a mode change", async () => {
  const root = account();
  for (const entry of [root, ...root.tools!])
    entry.pendingPurchase = { id, status: "PENDING", paymentTransactionId: 789 };
  let posts = 0;
  const subject = client(async (path, init) => {
    if (init?.method === "POST") posts++;
    return path === accessPath ? root : payment("PENDING", root, "BUNDLE");
  });
  await subject.enter("/pos");
  assert.equal(subject.getSnapshot().purchase?.id, id);
  await assert.rejects(
    subject.purchase(selection, review(subject.getSnapshot().access!)),
    /existing access/,
  );
  await subject.checkStatus();
  assert.equal(effectivePurchaseAction(subject.getSnapshot().purchase!), "BUSINESS_TOOLS_ACCESS");
  assert.equal(posts, 0);
});
test("uncertain separate payments reopen without a POST and explicit recovery reuses the identical intent after mode changes", async () => {
  const storage = session();
  const bodies: string[] = [];
  let mode: "PER_TOOL" | "BUNDLE" = "PER_TOOL";
  let granted = false;
  const request = async (path: string, init?: RequestInit) => {
    if (path === accessPath) return account(granted ? ["POS"] : [], mode);
    bodies.push(String(init?.body));
    if (bodies.length === 1) throw new Error("Lost response");
    granted = true;
    return payment("COMPLETED", account(["POS"], mode));
  };
  const first = client(request, storage);
  await first.enter("/pos");
  await first.purchase(selection, review(first.getSnapshot().access!));
  assert.equal(first.getSnapshot().uncertain, true);
  first.dispose();
  mode = "BUNDLE";
  const reopened = client(request, storage);
  await reopened.enter("/pos");
  assert.equal(bodies.length, 1);
  await reopened.retryIntent();
  assert.equal(bodies[0], bodies[1]);
  assert.equal(JSON.parse(bodies[1]).planCode, "RETURNED_POS");
  assert.equal(mayContinueToTool(reopened.getSnapshot(), "/pos"), true);
  assert.equal(mayMountOwnerData(reopened.getSnapshot(), "/developers", true), false);
  assert.equal(storage.getItem(recoveryPrefix + "owner"), null);
});
test("a definitive mode-change 409 refreshes the offer for review without replaying the rejected write", async () => {
  let mode: "PER_TOOL" | "BUNDLE" = "PER_TOOL";
  let posts = 0;
  const subject = client(async (path) => {
    if (path === accessPath) return account([], mode);
    posts++;
    mode = "BUNDLE";
    throw Object.assign(new Error("Refresh the current offer"), { status: 409 });
  });
  await subject.enter("/pos");
  await subject.purchase(selection, review(subject.getSnapshot().access!));
  assert.equal(subject.getSnapshot().access?.plan.code, "RETURNED_BUNDLE");
  assert.equal(subject.getSnapshot().intent, undefined);
  assert.equal(subject.getSnapshot().uncertain, false);
  assert.equal(posts, 1);
});
test("missing tool offers and malformed mode/action metadata fail closed without a guessed bundle purchase", async () => {
  for (const invalid of [
    { ...account(), pricingMode: "OTHER" },
    { ...account(), tools: [{ ...offer("API"), purchaseAction: "BUSINESS_TOOLS_ACCESS" }] },
  ])
    assert.throws(() => parseAccess(invalid));
  const subject = client(async () => ({ ...account(), tools: [offer("API")] }));
  await subject.enter("/pos");
  assert.equal(subject.getSnapshot().access, undefined);
  assert.equal(mayMountOwnerData(subject.getSnapshot(), "/pos", true), false);
  assert.match(subject.getSnapshot().error!, /offer is unavailable/);
  assert.throws(() => parsePurchase({ ...payment("PENDING", account()), tool: "OTHER" }));
});
