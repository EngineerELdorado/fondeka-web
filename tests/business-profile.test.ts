import { test } from "node:test";
import assert from "node:assert/strict";
import { businessDisplayName } from "../src/lib/business-profile";

test("Business identity omits missing names and generated account-reference placeholders", () => {
  assert.equal(businessDisplayName(), undefined);
  assert.equal(businessDisplayName({ name: "  ", legalName: " " }), undefined);
  for (const name of ["Business FDK096503424", "FDK096503424", "Business 42", "42"])
    assert.equal(businessDisplayName({ name }), undefined);
});

test("Business identity uses a real display or legal name without the generic prefix", () => {
  assert.equal(
    businessDisplayName({ name: " Atelier Kin ", legalName: "Atelier Kin SARL" }),
    "Atelier Kin",
  );
  assert.equal(
    businessDisplayName({ name: "Business FDK096503424", legalName: "Atelier Kin SARL" }),
    "Atelier Kin SARL",
  );
  assert.equal(businessDisplayName({ name: "Business Atelier Kin" }), "Atelier Kin");
});
