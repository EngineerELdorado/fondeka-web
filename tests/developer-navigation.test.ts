import test from "node:test";
import assert from "node:assert/strict";
import { businessDestination } from "../src/lib/business-tools";
import { toolLinkDestination } from "../src/lib/business-tools-ui";
import { developerHref, legacyDeveloperDestination } from "../src/lib/developer-navigation";

test("developer child destinations remain protected, bookmarkable internal routes", () => {
  for (const section of ["wallets", "transactions", "guides"]) {
    const destination = businessDestination(
      `/developers/${section}?business=42&environment=SANDBOX&returnTo=https://foreign.example&apiKey=secret`,
    );
    assert.ok(destination);
    assert.equal(toolLinkDestination(destination!), destination);
    const url = new URL(destination!, "https://portal.invalid");
    assert.equal(url.pathname, `/developers/${section}`);
    assert.equal(url.searchParams.get("business"), "42");
    assert.equal(url.searchParams.get("environment"), "SANDBOX");
    assert.equal(url.searchParams.has("returnTo"), false);
    assert.equal(url.searchParams.has("apiKey"), false);
  }
  for (const destination of [
    "/developers/admin",
    "/developers/keys/42",
    "/developers/guides/foreign",
    "https://foreign.example/developers/wallets",
    "//foreign.example/developers/guides",
  ])
    assert.equal(businessDestination(destination), undefined);
});

test("section navigation retains Business/environment without replaying a credential form or transaction selection", () => {
  const values = new URLSearchParams({
    business: "42",
    businessPage: "2",
    environment: "SANDBOX",
    apiReference: "SBX_payment",
    createKey: "1",
    flow: "api-key",
    step: "webhook",
    apiKey: "secret",
    returnTo: "//foreign.example",
  });
  assert.equal(
    developerHref("wallets", values),
    "/developers/wallets?business=42&businessPage=2&environment=SANDBOX",
  );
  assert.equal(
    developerHref("credentials", values),
    "/developers?business=42&businessPage=2&environment=SANDBOX",
  );
  assert.equal(
    developerHref("guides", new URLSearchParams({ business: "invalid", environment: "FAKE" })),
    "/developers/guides",
  );
});

test("legacy bookmarks reopen the intended history/detail or guide and preserve safe filters", () => {
  const transaction = legacyDeveloperDestination(
    new URLSearchParams({
      business: "42",
      environment: "SANDBOX",
      apiReference: "SBX_payment",
      api_currency: "CDF",
      apiPage: "3",
      returnTo: "https://foreign.example",
    }),
  );
  assert.ok(transaction?.startsWith("/developers/transactions?"));
  const url = new URL(transaction!, "https://portal.invalid");
  assert.equal(url.searchParams.get("apiReference"), "SBX_payment");
  assert.equal(url.searchParams.get("apiPage"), "3");
  assert.equal(url.searchParams.has("returnTo"), false);
  assert.equal(
    legacyDeveloperDestination(new URLSearchParams({ guide: "1", doc: "webhooks" })),
    "/developers/guides?doc=webhooks&guide=1",
  );
  assert.equal(
    legacyDeveloperDestination(new URLSearchParams(), "#integration-guide"),
    "/developers/guides",
  );
  assert.equal(
    legacyDeveloperDestination(new URLSearchParams({ createKey: "1", guide: "1" })),
    undefined,
  );
  assert.equal(legacyDeveloperDestination(new URLSearchParams({ business: "42" })), undefined);
});
