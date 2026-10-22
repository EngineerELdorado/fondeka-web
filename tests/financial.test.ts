import { test } from "node:test";
import assert from "node:assert/strict";
import { amountInMinorUnits, money, parseAmount, safeLink } from "../src/lib/format";
import { emptyFilters, portalQuery } from "../src/lib/portal-query";

test("money parsing preserves decimal values and rejects ambiguous or unsafe inputs", () => {
  assert.equal(amountInMinorUnits("0.29", "USD"), 29);
  assert.equal(parseAmount("12.50", "USD"), 12.5);
  for (const invalid of ["0", "-1", "1e3", "NaN", "1,000", "0.001", "9007199254740991"])
    assert.throws(() => parseAmount(invalid, "USD"));
  assert.equal(amountInMinorUnits("125", "XAF"), 125);
  assert.throws(() => parseAmount("1.50", "XAF"));
});
test("financial amounts retain their currency and missing amounts stay missing", () => {
  assert.equal(money(undefined, "USD"), "—");
  assert.equal(money(0, "USD"), "$0.00");
  assert.match(money(125, "EUR"), /€/);
  assert.match(money(125, "CDF"), /CDF/);
  assert.equal(safeLink("javascript:alert(1)"), undefined);
  assert.equal(safeLink("https://example.com/payment"), "https://example.com/payment");
});
test("portal filters use exact references, preserve merchant reference case, and encode query values", () => {
  const query = new URLSearchParams(
    portalQuery(
      {
        ...emptyFilters,
        action: "BUSINESS_API_COLLECTION",
        currency: "eur",
        reference: " TX123 ",
        clientReference: "Order&42=Yes",
      },
      3,
    ),
  );
  assert.equal(query.get("page"), "3");
  assert.equal(query.get("currency"), "EUR");
  assert.equal(query.get("reference"), "TX123");
  assert.equal(query.get("clientReference"), "Order&42=Yes");
  assert.equal(query.get("action"), "BUSINESS_API_COLLECTION");
  assert.equal(new URLSearchParams(portalQuery(emptyFilters, 0)).has("status"), false);
});
test("portal date filters use inclusive local calendar boundaries and reject inverted dates", () => {
  const query = new URLSearchParams(
    portalQuery({ ...emptyFilters, fromDate: "2026-10-01", toDate: "2026-10-02" }, 0),
  );
  assert.equal(query.get("fromDate"), String(new Date("2026-10-01T00:00:00").getTime()));
  assert.equal(query.get("toDate"), String(new Date("2026-10-02T23:59:59.999").getTime()));
  assert.throws(() =>
    portalQuery({ ...emptyFilters, fromDate: "2026-10-03", toDate: "2026-10-02" }, 0),
  );
  assert.throws(() => portalQuery({ ...emptyFilters, fromDate: "1960-01-01" }, 0));
});
