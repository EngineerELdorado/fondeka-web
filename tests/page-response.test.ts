import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePageResponse } from "../src/lib/page-response";
import { parseSandboxEntries } from "../src/lib/api-wallets";

const metadata = { number: 0, size: 20, totalElements: 42, totalPages: 3 };

test("Spring Data VIA_DTO page metadata is flattened without guessing totals from a partial page", () => {
  const content = [{ id: 42, name: "Store" }];
  const normalized = normalizePageResponse<unknown>({ content, page: metadata }) as Record<
    string,
    unknown
  >;
  assert.equal(normalized.content, content);
  assert.equal(normalized.totalElements, 42);
  assert.equal(normalized.totalPages, 3);
  assert.equal(normalized.number, 0);
  assert.equal(normalized.size, 20);
  assert.equal(normalized.first, true);
  assert.equal(normalized.last, false);
  assert.equal(normalized.empty, false);
  assert.deepEqual(normalizePageResponse(normalized), normalized);
});

test("empty and later pages retain the backend number, size and totals", () => {
  const empty = normalizePageResponse<unknown>({
    content: [],
    page: { ...metadata, totalElements: 0, totalPages: 0 },
  }) as Record<string, unknown>;
  assert.equal(empty.totalElements, 0);
  assert.equal(empty.empty, true);
  assert.equal(empty.last, true);
  const later = normalizePageResponse<unknown>({
    content: [{ id: 7 }],
    page: { ...metadata, number: 2, size: 7 },
  }) as Record<string, unknown>;
  assert.equal(later.number, 2);
  assert.equal(later.size, 7);
  assert.equal(later.totalElements, 42);
  assert.equal(later.first, false);
  assert.equal(later.last, true);
});

test("legacy flat pages, arrays, individual resources and mutation responses stay unchanged", () => {
  for (const value of [
    null,
    undefined,
    0,
    [],
    [{ id: 42 }],
    { content: [], ...metadata },
    { id: 1, page: null },
    { currency: "CDF", amount: 10.25, environment: "SANDBOX" },
  ])
    assert.equal(normalizePageResponse(value), value);
});

test("missing or malformed nested totals remain errors rather than becoming an empty result", () => {
  for (const page of [
    null,
    {},
    { ...metadata, number: -1 },
    { ...metadata, size: 0 },
    { ...metadata, totalElements: "42" },
    { ...metadata, totalPages: NaN },
    { ...metadata, totalElements: -1 },
    { ...metadata, totalPages: undefined },
  ])
    assert.throws(() => normalizePageResponse({ content: [], page }), /invalid pagination/);
});

test("page normalization preserves financial records and ignores unrelated metadata fields", () => {
  const entry = {
    id: "entry-1",
    currency: "CDF",
    kind: "PAYOUT_DEBIT",
    amount: -10.3,
    balanceAfter: 89.7,
    businessId: 42,
    paymentReference: "SBXsample",
    conversionId: null,
    createdAt: "2026-10-23T12:00:00Z",
    environment: "SANDBOX",
    sequence: 1,
  };
  const response = {
    content: [entry],
    environment: "SANDBOX",
    page: {
      number: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      environment: "LIVE",
      content: [],
      amount: 0,
    },
  };
  const normalized = normalizePageResponse(response);
  assert.equal(normalized.content[0], entry);
  assert.equal(normalized.environment, "SANDBOX");
  const parsed = parseSandboxEntries(normalized, "CDF");
  assert.equal(parsed.content[0].amount, -10.3);
  assert.equal(parsed.content[0].balanceAfter, 89.7);
  assert.equal(parsed.totalElements, 1);
});
