import { test } from "node:test";
import assert from "node:assert/strict";
import { date } from "../src/lib/format";

function inTimeZone(zone: string, check: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    check();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

test("timestamps show the date, hours, minutes, seconds and time zone in English and French", () => {
  inTimeZone("UTC", () => {
    const english = date("2026-10-26T13:04:05Z", "en-US");
    assert.match(english, /Oct 26, 2026/);
    assert.match(english, /13:04:05/);
    assert.match(english, /UTC/);
    assert.doesNotMatch(english, /AM|PM/);
    const french = date("2026-10-26T13:04:05Z", "fr");
    assert.match(french, /26 oct/);
    assert.match(french, /13:04:05/);
    assert.match(french, /UTC/);
    assert.match(date("2026-10-26T13:04:05+02:00", "en-US"), /11:04:05/);
  });
});

test("local timestamps respect daylight saving time and calendar-day changes", () => {
  inTimeZone("Europe/Luxembourg", () => {
    assert.match(date("2026-01-26T12:00:00Z", "en-GB"), /13:00:00/);
    assert.match(date("2026-07-26T12:00:00Z", "en-GB"), /14:00:00/);
  });
  inTimeZone("America/New_York", () => {
    const previousDay = date("2026-10-26T00:30:09Z", "en-US");
    assert.match(previousDay, /Oct 25, 2026/);
    assert.match(previousDay, /20:30:09/);
  });
});

test("calendar-only dates retain their exact day without inventing a clock time", () => {
  inTimeZone("America/New_York", () => {
    assert.equal(date("2026-10-26", "en-US"), "Oct 26, 2026");
  });
});

test("missing and invalid dates keep the empty placeholder", () => {
  for (const value of [undefined, null, "", "not-a-date"]) assert.equal(date(value), "—");
});
