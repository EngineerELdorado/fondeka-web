import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessApiPaymentStatuses,
  isBusinessApiPaymentStatus,
  isTerminalBusinessApiPayment,
  isPendingBusinessApiPayment,
} from "../src/lib/business-api-status";
import { portalQuery, emptyFilters } from "../src/lib/portal-query";
import { assertTransactionEnvironment } from "../src/lib/api-environment";
import { demoRequest } from "../src/lib/demo";
import type { ApiTransaction, Page } from "../src/lib/types";

test("Business API accepts and filters all four statuses distinctly in either environment", async () => {
  assert.deepEqual(businessApiPaymentStatuses, ["ACCEPTED", "PROCESSING", "COMPLETED", "FAILED"]);
  for (const environment of ["LIVE", "SANDBOX"] as const) {
    const all = await demoRequest<Page<ApiTransaction>>(
      `/customer-api/businesses/1/api-transactions?environment=${environment}&size=100`,
    );
    for (const row of all.content) {
      assert.equal(isBusinessApiPaymentStatus(row.transaction.status), true);
      assertTransactionEnvironment(row.transaction, environment);
    }
    for (const status of businessApiPaymentStatuses) {
      const query = portalQuery({ ...emptyFilters, status }, 0, environment);
      assert.equal(new URLSearchParams(query).get("status"), status);
      const filtered = await demoRequest<Page<ApiTransaction>>(
        `/customer-api/businesses/1/api-transactions?${query}`,
      );
      assert.ok(filtered.content.length > 0, `${environment}: ${status}`);
      assert.ok(filtered.content.every((row) => row.transaction.status === status));
      const payment: ApiTransaction["transaction"] = filtered.content[0].transaction;
      const detail: ApiTransaction = await demoRequest<ApiTransaction>(
        `/customer-api/businesses/1/api-transactions/${payment.fondekaReference}?environment=${environment}`,
      );
      assert.equal(detail.transaction.status, status);
      assert.equal(detail.transaction.fondekaReference, payment.fondekaReference);
      assertTransactionEnvironment(detail.transaction, environment);
    }
    assert.equal(
      new URLSearchParams(portalQuery(emptyFilters, 0, environment)).has("status"),
      false,
    );
  }
});
test("legacy internal statuses are rejected rather than normalized independently in the portal", () => {
  for (const status of [
    "PENDING",
    "NONE",
    "FUNDED",
    "EXECUTING",
    "UNKNOWN",
    "MANUAL_INTERVENTION_REQUIRED",
    "CANCELED",
    "EXPIRED",
  ]) {
    assert.equal(isBusinessApiPaymentStatus(status), false);
    assert.throws(() => portalQuery({ ...emptyFilters, status }, 0), /status filter/);
    assert.throws(
      () =>
        assertTransactionEnvironment(
          {
            fondekaReference: "TX001",
            environment: "LIVE",
            status,
          } as ApiTransaction["transaction"],
          "LIVE",
        ),
      /outdated Business API/,
    );
  }
});
test("both queued and processing payments keep polling; only confirmed outcomes are terminal", () => {
  for (const status of businessApiPaymentStatuses) {
    const pending = status === "ACCEPTED" || status === "PROCESSING";
    assert.equal(isPendingBusinessApiPayment(status), pending);
    assert.equal(isTerminalBusinessApiPayment(status), !pending);
  }
  for (const status of [undefined, null, "PENDING", "UNKNOWN", "MANUAL_INTERVENTION_REQUIRED"])
    assert.equal(isPendingBusinessApiPayment(status), false);
});
test("expiry is a failure reason and a failed payout never implies refunded", async () => {
  const all = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?environment=SANDBOX&size=100",
  );
  const expired = all.content.find((row) => row.transaction.failureCode === "EXPIRED")!;
  assert.equal(expired.transaction.status, "FAILED");
  assert.equal(Object.hasOwn(expired.transaction, "refunded"), false);
  const payout = all.content.find(
    (row) =>
      row.transaction.action === "BUSINESS_API_PAYOUT" && row.transaction.status === "FAILED",
  )!;
  assert.equal(Object.hasOwn(payout.transaction, "refunded"), false);
});
