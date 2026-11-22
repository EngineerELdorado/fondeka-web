import { test } from "node:test";
import assert from "node:assert/strict";
import { PosCommand } from "../src/lib/pos-command";
import {
  assertDiscountQuote,
  confirmedExport,
  confirmedOrder,
  correctionPolicyInput,
  decimalAmount,
  discountInput,
  pdfDownloadUrl,
  saleActionAllowed,
  saleActionUnavailableReason,
} from "../src/lib/pos-management";
import { receiptHtml, receiptText } from "../src/lib/receipt";
import { allowedProxyRoute, forwardsIdempotencyKey } from "../src/lib/proxy-policy";
import type { Order, Store } from "../src/lib/types";

const store: Store = {
  id: 1,
  name: "Shop",
  slug: "shop",
  defaultCurrency: "USD",
  status: "ACTIVE",
  accessType: "STAFF",
  staffPermissions: ["POS"],
  posFeatures: { installments: true, corrections: true },
};
const order: Order = {
  id: 1,
  reference: "POS-1",
  storeId: 1,
  channel: "POS",
  status: "PARTIALLY_PAID",
  totalAmount: 100,
  totalCurrency: "USD",
  amountPaid: 30,
  balanceDue: 70,
  posPaymentMode: "CASH",
  createdAt: "2026-11-20T10:00:00Z",
  version: 4,
  posActions: {
    canRecordPayment: true,
    canCorrect: true,
    canVoid: true,
    correctionAllowedUntil: "2026-11-21T10:00:00Z",
  },
};
const before = Date.parse("2026-11-21T09:59:59Z");
test("disabled actions explain their feature, permission and deadline requirements", () => {
  assert.equal(saleActionUnavailableReason(store, order, "correct", before), undefined);
  assert.equal(
    saleActionUnavailableReason({ ...store, posFeatures: undefined }, order, "correct", before),
    "feature",
  );
  assert.equal(
    saleActionUnavailableReason(
      { ...store, staffPermissions: ["SALES"] },
      order,
      "correct",
      before,
    ),
    "permission",
  );
  assert.equal(
    saleActionUnavailableReason(store, { ...order, posPaymentMode: "FONDEKA" }, "void", before),
    "provider",
  );
  assert.equal(
    saleActionUnavailableReason(store, { ...order, version: undefined }, "correct", before),
    "refresh",
  );
  assert.equal(
    saleActionUnavailableReason(store, { ...order, status: "VOIDED" }, "void", before),
    "voided",
  );
  assert.equal(saleActionUnavailableReason(store, order, "correct", before + 1000), "window");
  assert.equal(
    saleActionUnavailableReason(store, { ...order, balanceDue: 0 }, "payment", before),
    "paid",
  );
});
test("sale corrections require an explicit server grant and close at the exact deadline", () => {
  assert(saleActionAllowed(store, order, "correct", before));
  assert(saleActionAllowed(store, order, "void", before));
  assert(!saleActionAllowed(store, order, "correct", before + 1000));
  for (const changed of [
    { storeId: 9 },
    { version: undefined },
    { posActions: undefined },
    { channel: "ONLINE" },
    { posPaymentMode: "FONDEKA" },
    { status: "VOIDED" },
    { posActions: { ...order.posActions!, canCorrect: false } },
  ])
    assert(!saleActionAllowed(store, { ...order, ...changed }, "correct", before));
  assert(!saleActionAllowed({ ...store, posFeatures: undefined }, order, "correct", before));
  assert(!saleActionAllowed({ ...store, staffPermissions: ["SALES"] }, order, "correct", before));
  assert(
    !saleActionAllowed(
      {
        ...store,
        accessType: "OWNER",
        capabilities: { canUsePos: false } as Store["capabilities"],
      },
      order,
      "correct",
      before,
    ),
  );
});
test("installments remain possible after the correction window but cannot overrule voids or payment restrictions", () => {
  assert(saleActionAllowed(store, order, "payment", before + 86400000));
  for (const changed of [
    { balanceDue: 0 },
    { balanceDue: NaN },
    { posPaymentMode: "FONDEKA" },
    { status: "VOIDED" },
    { posActions: { ...order.posActions!, canRecordPayment: false } },
  ])
    assert(!saleActionAllowed(store, { ...order, ...changed }, "payment", before));
});
test("discounts preserve type, currency, reason and precision, and an ignored discount never becomes a sale", () => {
  const discount = discountInput("FIXED", "10,50", " Negotiated price ", "USD");
  assert.deepEqual(discount, {
    type: "FIXED",
    value: 10.5,
    currency: "USD",
    reason: "Negotiated price",
  });
  const quote = {
    totalAmount: 89.5,
    totalCurrency: "USD",
    feeAmount: 0,
    discountAmount: 10.5,
    discount: { reason: discount.reason, currency: "USD", value: 10.5, type: "FIXED" as const },
  };
  assert.doesNotThrow(() => assertDiscountQuote(discount, quote));
  assert.throws(() => assertDiscountQuote(discount, { ...quote, discount: undefined }));
  assert.throws(() =>
    assertDiscountQuote(discount, { ...quote, discount: { ...discount, currency: "EUR" } }),
  );
  for (const value of ["0", "-1", "100", "100.01", "1.001", "Infinity", "1e2"])
    assert.throws(() => discountInput("PERCENTAGE", value, "Reason", "USD"));
  assert.throws(() => discountInput("FIXED", "5", " ", "USD"));
  assert.equal(decimalAmount("100", "JPY"), 100);
  assert.throws(() => decimalAmount("100.1", "JPY"));
  assert.throws(() => decimalAmount("9007199254740992", "USD"));
});
test("owner policy windows are versioned, role-specific whole hours with an explicit zero option", () => {
  assert.deepEqual(correctionPolicyInput("24", "168", 2), {
    version: 2,
    staffWindowHours: 24,
    ownerWindowHours: 168,
  });
  assert.equal(correctionPolicyInput("0", "0", 0).staffWindowHours, 0);
  for (const [staff, owner] of [
    ["-1", "24"],
    ["24", "1"],
    ["1.5", "168"],
    ["24", "8761"],
  ])
    assert.throws(() => correctionPolicyInput(staff, owner, 2));
});
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const path = "/customer-api/commerce/stores/1/pos/orders/POS-1/payments";
test("a lost installment response survives reload and retries identical bytes and key despite edited inputs", async () => {
  const saved = storage();
  const calls: RequestInit[] = [];
  const client = new PosCommand({
    accountKey: "owner",
    path,
    storage: saved,
    uuid: () => "first",
    request: async (_path, init) => {
      calls.push(init);
      throw new Error("Lost response");
    },
  });
  await client.submit({ expectedVersion: 4, amount: 20, currency: "USD" }, (value) =>
    confirmedOrder(value, 1, "POS-1"),
  );
  assert(client.getSnapshot().intent);
  const recovery = new PosCommand({
    accountKey: "owner",
    path,
    storage: saved,
    request: async <T>(_path: string, init: RequestInit) => {
      calls.push(init);
      return { ...order, version: 5, amountPaid: 50, balanceDue: 50 } as T;
    },
  });
  const result = await recovery.submit({ expectedVersion: 99, amount: 100 }, (value) =>
    confirmedOrder(value, 1, "POS-1"),
  );
  assert.equal(result?.amountPaid, 50);
  assert.equal(calls[0].body, calls[1].body);
  assert.deepEqual(calls[0].headers, calls[1].headers);
  assert.equal(saved.values.size, 0);
  await recovery.submit({ amount: 20 }, (value) => value);
  assert.equal(calls.length, 2);
});
test("rapid duplicate submissions share the first in-flight operation", async () => {
  let resolve!: (value: unknown) => void;
  let calls = 0;
  const client = new PosCommand({
    accountKey: "owner",
    path,
    storage: storage(),
    request: async <T>() => {
      calls++;
      return (await new Promise<unknown>((done) => {
        resolve = done;
      })) as T;
    },
  });
  const first = client.submit({ amount: 20 }, (value) => value);
  await client.submit({ amount: 50 }, (value) => value);
  assert.equal(calls, 1);
  resolve(order);
  await first;
});
test("the gateway permits only the new store-scoped verbs, forwards mutation keys, and blocks unverified deletion", () => {
  const base = "customer-api/commerce/stores/1";
  const endpoints: [string, string][] = [
    ["/pos/orders/POS-1/payments", "POST"],
    ["/pos/orders/POS-1/corrections", "POST"],
    ["/pos/orders/POS-1/corrections/quote", "POST"],
    ["/pos/orders/POS-1/voids", "POST"],
    ["/pos/correction-policy", "PATCH"],
    ["/reports/sales/exports", "POST"],
    ["/reports/sales/exports/job-1", "GET"],
    ["/deletion-challenges", "POST"],
    ["/deletion-confirmations", "POST"],
  ];
  for (const [path, method] of endpoints) {
    for (const verb of ["GET", "POST", "PATCH", "DELETE", "PUT"])
      assert.equal(allowedProxyRoute(base + path, verb), method === verb);
  }
  assert(!allowedProxyRoute(base, "DELETE"));
  assert(forwardsIdempotencyKey(base + "/pos/orders/POS-1/payments", "POST"));
  assert(forwardsIdempotencyKey(base + "/reports/sales/exports", "POST"));
  assert(!forwardsIdempotencyKey(base + "/pos/orders/POS-1/corrections/quote", "POST"));
  assert(!forwardsIdempotencyKey(base + "/deletion-confirmations", "POST"));
});
test("blocked storage prevents a write, and corrupt recovery or another account cannot reuse the intent", async () => {
  let calls = 0;
  const saved = storage();
  const client = new PosCommand({
    accountKey: "one",
    path,
    storage: {
      ...saved,
      setItem: () => {
        throw new Error("blocked");
      },
    },
    request: async <T>() => {
      calls++;
      return order as T;
    },
  });
  await client.submit({}, (value) => value);
  assert.equal(calls, 0);
  saved.setItem("fondeka-pos-command:one:" + path, "bad json");
  const corrupt = new PosCommand({
    accountKey: "one",
    path,
    storage: saved,
    request: async <T>() => {
      calls++;
      return order as T;
    },
  });
  await corrupt.submit({}, (value) => value);
  assert(corrupt.getSnapshot().blocked);
  assert.equal(calls, 0);
  const other = new PosCommand({
    accountKey: "two",
    path,
    storage: saved,
    request: async <T>() => order as T,
  });
  assert.equal(other.getSnapshot().intent, undefined);
});
test("unverified success retains recovery; explicit version conflicts permit a fresh reviewed request", async () => {
  const saved = storage();
  const client = new PosCommand({
    accountKey: "owner",
    path,
    storage: saved,
    request: async <T>() => ({ ...order, storeId: 8 }) as T,
  });
  await client.submit({}, (value) => confirmedOrder(value, 1, "POS-1"));
  assert(client.getSnapshot().intent);
  const conflict = new PosCommand({
    accountKey: "other",
    path,
    storage: storage(),
    request: async () => {
      throw Object.assign(new Error("Sale changed"), {
        status: 409,
        code: "SALE_VERSION_CONFLICT",
      });
    },
  });
  await conflict.submit({}, (value) => value);
  assert.equal(conflict.getSnapshot().intent, undefined);
});
test("a recovered request keeps its key after a rejection because an earlier attempt may have completed", async () => {
  const saved = storage();
  const initial = new PosCommand({
    accountKey: "owner",
    path,
    storage: saved,
    request: async () => {
      throw new Error("Lost");
    },
  });
  await initial.submit({ amount: 20 }, (value) => value);
  const replay = new PosCommand({
    accountKey: "owner",
    path,
    storage: saved,
    request: async () => {
      throw Object.assign(new Error("Denied"), { status: 403 });
    },
  });
  await replay.submit({}, (value) => value);
  assert(replay.getSnapshot().intent);
});
test("PDF downloads require an authorized store job, safe HTTPS URL and an unexpired link", () => {
  const job = confirmedExport(
    {
      id: "job-1",
      storeId: 1,
      status: "COMPLETED",
      createdAt: "2026-11-21T09:00:00Z",
      fromDate: "2026-11-20",
      toDate: "2026-11-21",
      currency: "USD",
      language: "en",
      expiresAt: "2026-11-21T10:00:00Z",
      downloadUrl: "https://files.example.test/report.pdf?signature=fixture",
    },
    1,
  );
  assert(pdfDownloadUrl(job, before));
  assert.equal(pdfDownloadUrl(job, before + 1000), undefined);
  assert.equal(pdfDownloadUrl({ ...job, expiresAt: "invalid" }, before), undefined);
  for (const downloadUrl of [
    "javascript:alert(1)",
    "http://example.test/file.pdf",
    "https://user:pass@example.test/a.pdf",
  ])
    assert.equal(pdfDownloadUrl({ ...job, downloadUrl }, before), undefined);
  assert.throws(() => confirmedExport({ ...job, storeId: 2 }, 1));
  assert.throws(() => confirmedExport(job, 1, { currency: "EUR" }));
  assert.throws(() => confirmedExport(job, 1, { id: "another-job" }));
  assert.throws(() => confirmedOrder(order, 1, "POS-1", order.version));
});
test("receipts include installment references and escaped discount reasons", () => {
  const sale: Order = {
    ...order,
    discount: { type: "FIXED", value: 10, currency: "USD", reason: "<script>bad</script>" },
    discountAmount: 10,
    subtotalBeforeDiscountAmount: 110,
    payments: [
      {
        id: "pay-1",
        amount: 20,
        currency: "USD",
        method: "CASH",
        reference: "receipt-2",
        receivedAt: order.createdAt,
        recordedAt: order.createdAt,
        recordedBy: "Staff",
      },
    ],
  };
  assert.match(receiptText(sale), /Payment received:.*20\.00/);
  assert.match(receiptText(sale), /receipt-2/);
  assert.match(receiptHtml(sale), /&lt;script&gt;/);
  assert(!receiptHtml(sale).includes("<script>"));
});
