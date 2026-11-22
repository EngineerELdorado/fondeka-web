import test from "node:test";
import assert from "node:assert/strict";
import { expenseInput, confirmedExpense } from "../src/lib/store-expenses";
import { allowedProxyRoute, forwardsIdempotencyKey } from "../src/lib/proxy-policy";
import { canUseStore, storeTabAllowed, reportQuery } from "../src/lib/commerce";
import type { Store } from "../src/lib/types";
import { businessDestination } from "../src/lib/business-tools";

test("the activation navigation guard preserves Expenses and its safe report filters", () => {
  const destination =
    "/stores/2?tab=expenses&period=custom&currency=USD&from=2026-11-01&to=2026-11-21";
  assert.equal(businessDestination(destination), destination);
  assert.equal(
    businessDestination("/stores/2?tab=expenses&returnTo=https://example.test"),
    "/stores/2?tab=expenses",
  );
  assert.equal(businessDestination("/stores/2?tab=unknown"), "/stores/2");
});
const draft = {
  amount: "25,50",
  currency: "usd",
  paidOn: "2026-01-01",
  category: "RENT" as const,
  description: " Rent ",
  method: "CASH" as const,
};
test("expenses normalize currency, minor units and optional reference fields", () => {
  assert.deepEqual(expenseInput(draft), {
    ...draft,
    amount: 25.5,
    currency: "USD",
    description: "Rent",
    payee: null,
    reference: null,
  });
  for (const patch of [
    { amount: "0" },
    { amount: "-1" },
    { amount: "1.001" },
    { amount: "1.5", currency: "JPY" },
    { description: " " },
    { paidOn: "2026-02-30" },
    { paidOn: "2999-01-01" },
  ])
    assert.throws(() => expenseInput({ ...draft, ...patch }));
});
test("only exact expense routes and verbs pass the proxy; all writes keep idempotency", () => {
  const path = "/customer-api/commerce/stores/5/expenses".slice(1),
    id = "11111111-1111-4111-8111-111111111111";
  for (const suffix of ["", `/${id}/corrections`, `/${id}/voids`]) {
    assert.ok(allowedProxyRoute(path + suffix, "POST"));
    assert.ok(forwardsIdempotencyKey(path + suffix, "POST"));
    assert.equal(allowedProxyRoute(path + suffix, "DELETE"), false);
  }
  assert.ok(allowedProxyRoute(`${path}/${id}/history`, "GET"));
  assert.equal(allowedProxyRoute(`${path}/anything/corrections`, "POST"), false);
});
test("expense permission is independent of sales, POS and reports", () => {
  const owner = { accessType: "OWNER" } as Store;
  assert.ok(storeTabAllowed(owner, "expenses"));
  const staff = { accessType: "STAFF", staffPermissions: ["POS", "SALES", "REPORTS"] } as Store;
  assert.equal(canUseStore(staff, "EXPENSES"), false);
  assert.ok(canUseStore({ ...staff, staffPermissions: ["EXPENSES"] }, "EXPENSES"));
  assert.equal(
    canUseStore(
      { ...owner, capabilities: { canManageExpenses: false } as Store["capabilities"] },
      "EXPENSES",
    ),
    false,
  );
});
test("unconfirmed expense responses retain the operation for recovery", () => {
  const e = {
    id: "11111111-1111-4111-8111-111111111111",
    storeId: 5,
    version: 1,
    amount: 25,
    currency: "USD",
    status: "RECORDED",
  };
  assert.equal(confirmedExpense(e, 5), e);
  assert.throws(() => confirmedExpense(e, 6));
  assert.throws(() => confirmedExpense(e, 5, { status: "VOIDED" }));
  assert.throws(() => confirmedExpense({ ...e, version: undefined }, 5));
});

test("report requests preserve the local timezone and selected date range", () => {
  const query = new URLSearchParams(
    reportQuery("custom", "USD", "2026-11-22", "2026-11-22", "Europe/Luxembourg"),
  );
  assert.equal(query.get("timeZone"), "Europe/Luxembourg");
  assert.equal(query.get("from"), "2026-11-22");
  assert.equal(query.get("to"), "2026-11-22");
  const today = new URLSearchParams(
    reportQuery("today", "", undefined, undefined, "Africa/Kinshasa"),
  );
  assert.equal(today.get("period"), "today");
  assert.equal(today.get("timeZone"), "Africa/Kinshasa");
});
