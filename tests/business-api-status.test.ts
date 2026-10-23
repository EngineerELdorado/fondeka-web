import { test } from "node:test";
import assert from "node:assert/strict";
import {
  businessApiPaymentStatuses,
  isBusinessApiPaymentStatus,
  isTerminalBusinessApiPayment,
} from "../src/lib/business-api-status";
import { portalQuery, emptyFilters } from "../src/lib/portal-query";
import { assertTransactionEnvironment } from "../src/lib/api-environment";
import { demoRequest } from "../src/lib/demo";
import type { ApiTransaction, Page } from "../src/lib/types";

test("Business API exposes only the three backend-normalized statuses, in either environment", async () => {
  assert.deepEqual(businessApiPaymentStatuses, ["PROCESSING", "COMPLETED", "FAILED"]);
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
      assert.ok(filtered.content.every((row) => row.transaction.status === status));
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
    "ACCEPTED",
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
          { reference: "TX001", status } as ApiTransaction["transaction"],
          "LIVE",
        ),
      /outdated Business API/,
    );
  }
  assert.equal(isTerminalBusinessApiPayment("PROCESSING"), false);
  assert.equal(isTerminalBusinessApiPayment("COMPLETED"), true);
  assert.equal(isTerminalBusinessApiPayment("FAILED"), true);
});
test("expiry is a failure reason and a failed payout never implies refunded", async () => {
  const all = await demoRequest<Page<ApiTransaction>>(
    "/customer-api/businesses/1/api-transactions?environment=SANDBOX&size=100",
  );
  const expired = all.content.find((row) => row.transaction.failureCode === "EXPIRED")!;
  assert.equal(expired.transaction.status, "FAILED");
  assert.equal(expired.transaction.refunded, false);
  const payout = all.content.find(
    (row) =>
      row.transaction.action === "BUSINESS_API_PAYOUT" && row.transaction.status === "FAILED",
  )!;
  assert.equal(payout.transaction.refunded, false);
});
