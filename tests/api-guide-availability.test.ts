import { test } from "node:test";
import assert from "node:assert/strict";
import { apiGuideAvailable, billPaymentGuidesReady } from "../src/lib/api-guide-availability";
import { apiGuideTracks, availableGuideMenuTracks } from "../src/lib/api-guide-content";
import type { ApiGuideSetup } from "../src/lib/api-guide-setup";

const readySetup: ApiGuideSetup = {
  business: {
    id: 42,
    name: "Merchant",
    status: "ACTIVE",
    kybStatus: "APPROVED",
    billPaymentsApiReady: true,
  },
  environment: "SANDBOX",
  loading: false,
  refresh() {},
};

test("only explicit backend readiness opens bill guides, independently of build mode", () => {
  assert.equal(apiGuideAvailable("bill-payments", true), true);
  for (const value of [false, undefined, null, "true", "development", "production", 1, {}, []])
    assert.equal(apiGuideAvailable("bill-payments", value), false);
  for (const track of apiGuideTracks.filter((track) => track.id !== "bill-payments")) {
    assert.equal(apiGuideAvailable(track.id, false), true, track.id);
    assert.equal(apiGuideAvailable(track.id, true), true, track.id);
  }
});

test("guide readiness follows the selected business and closes for missing, loading or failed setup", () => {
  for (const environment of ["LIVE", "SANDBOX"] as const)
    assert.equal(billPaymentGuidesReady({ ...readySetup, environment }), true);
  assert.equal(billPaymentGuidesReady({ ...readySetup, loading: true }), false);
  assert.equal(billPaymentGuidesReady({ ...readySetup, error: "Discovery failed" }), false);
  assert.equal(billPaymentGuidesReady({ ...readySetup, business: undefined }), false);
  for (const readiness of [false, undefined, "true", 1, null]) {
    const business = {
      ...readySetup.business!,
      id: 43,
      billPaymentsApiReady: readiness,
    } as ApiGuideSetup["business"];
    assert.equal(billPaymentGuidesReady({ ...readySetup, business }), false);
  }
  assert.equal(billPaymentGuidesReady(readySetup), true);
});

test("the guide sequence includes bill lessons only while the backend marks them ready", () => {
  assert.ok(apiGuideTracks.some((track) => track.id === "bill-payments"));
  for (const value of [undefined, false, "true", "development", true]) {
    const tracks = availableGuideMenuTracks(value);
    assert.equal(
      tracks.some((track) => track.id === "bill-payments"),
      value === true,
    );
    assert.ok(tracks.some((track) => track.id === "webhooks"));
    assert.ok(tracks.some((track) => track.id === "go-live"));
  }
});
