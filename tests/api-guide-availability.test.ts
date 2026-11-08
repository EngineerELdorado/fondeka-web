import { test } from "node:test";
import assert from "node:assert/strict";
import { apiGuideAvailable } from "../src/lib/api-guide-availability";
import { apiGuideTracks, apiGuideMenuTracks } from "../src/lib/api-guide-content";

test("bill payments are a development preview and never enabled by production or an unknown mode", () => {
  assert.equal(apiGuideAvailable("bill-payments", "development"), true);
  for (const mode of ["production", "test", "preview", "", undefined])
    assert.equal(
      apiGuideAvailable("bill-payments", mode),
      mode === undefined && process.env.NODE_ENV === "development",
    );
  for (const track of apiGuideTracks.filter((track) => track.id !== "bill-payments")) {
    assert.equal(apiGuideAvailable(track.id, "production"), true, track.id);
    assert.equal(apiGuideAvailable(track.id, "development"), true, track.id);
  }
});

test("the guide sequence never advances into unavailable bill lessons", () => {
  assert.ok(apiGuideTracks.some((track) => track.id === "bill-payments"));
  assert.equal(
    apiGuideMenuTracks.some((track) => track.id === "bill-payments"),
    process.env.NODE_ENV === "development",
  );
});
