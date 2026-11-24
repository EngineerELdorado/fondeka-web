import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apiGuideAvailable,
  billGuideLessonAvailable,
  billPaymentGuideAvailability,
  billPaymentGuidesReady,
  normalizeBillPaymentAvailability,
} from "../src/lib/api-guide-availability";
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

test("public guide readiness uses the global flag rather than Business metadata", () => {
  const publicSetup = { ...readySetup, audience: "public" as const };
  assert.equal(billPaymentGuidesReady(publicSetup), false);
  assert.equal(
    billPaymentGuidesReady({ ...publicSetup, business: undefined, publicBillPaymentsReady: true }),
    true,
  );
});

test("electricity can open independently of TV and the legacy whole-bill flag", () => {
  const availability = { ELECTRICITY: true, TELEVISION: false, WATER: false };
  const setup = {
    ...readySetup,
    business: {
      ...readySetup.business!,
      billPaymentsApiReady: false,
      billPaymentsApiAvailability: availability,
    },
  };
  assert.equal(billPaymentGuidesReady(setup), true);
  const resolved = billPaymentGuideAvailability(setup);
  const lessons = apiGuideTracks.find((track) => track.id === "bill-payments")!.lessons;
  const enabled = lessons.filter((lesson) => billGuideLessonAvailable(lesson, resolved));
  assert.ok(enabled.some((lesson) => lesson.id === "request"));
  assert.ok(enabled.some((lesson) => lesson.id === "electricity-estimate"));
  assert.ok(enabled.some((lesson) => lesson.id === "discover"));
  assert.ok(!enabled.some((lesson) => lesson.id === "television"));
  const paymentIndex = enabled.findIndex((lesson) => lesson.id === "request");
  assert.equal(
    enabled[paymentIndex + 1].id,
    "confirmation",
    "Next skips the disabled TV payment lesson",
  );
  assert.equal(
    billGuideLessonAvailable(
      lessons.find((lesson) => lesson.id === "television")!,
      resolved,
    ),
    false,
    "saved TV links remain blocked",
  );
});

test("TV-only and future categories keep shared reference available without opening electricity", () => {
  const tv = { TELEVISION: true, ELECTRICITY: false };
  assert.equal(billGuideLessonAvailable({ billCategory: "TELEVISION" }, tv), true);
  assert.equal(billGuideLessonAvailable({ billCategory: "ELECTRICITY" }, tv), false);
  assert.equal(billGuideLessonAvailable({}, tv), true);
  const future = normalizeBillPaymentAvailability(false, { INTERNET: true });
  assert.equal(billGuideLessonAvailable({ billCategory: "INTERNET" }, future), true);
  assert.equal(billGuideLessonAvailable({}, future), true);
});

test("explicit maps fail closed for missing, malformed and nonboolean values and override legacy true", () => {
  for (const value of [null, [], "true", 1, {}, { ELECTRICITY: "true" }, { ELECTRICITY: false }]) {
    const availability = normalizeBillPaymentAvailability(true, value);
    assert.equal(billGuideLessonAvailable({ billCategory: "ELECTRICITY" }, availability), false);
    assert.equal(billGuideLessonAvailable({ billCategory: "TELEVISION" }, availability), false);
  }
  assert.equal(
    billGuideLessonAvailable(
      { billCategory: "TELEVISION" },
      normalizeBillPaymentAvailability(true),
    ),
    true,
  );
  assert.deepEqual(billPaymentGuideAvailability({ ...readySetup, loading: true }), {});
});

test("public category rollout stays separate from private account overrides", () => {
  const setup = {
    ...readySetup,
    audience: "public" as const,
    business: { ...readySetup.business!, billPaymentsApiAvailability: { TELEVISION: true } },
    publicBillPaymentsReady: false,
    publicBillPaymentsAvailability: { ELECTRICITY: true, TELEVISION: false },
  };
  assert.equal(billPaymentGuidesReady(setup), true);
  assert.equal(billPaymentGuideAvailability(setup).ELECTRICITY, true);
  assert.equal(billPaymentGuideAvailability(setup).TELEVISION, false);
});
