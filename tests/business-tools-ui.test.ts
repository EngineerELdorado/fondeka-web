import { test } from "node:test";
import assert from "node:assert/strict";
import { BusinessToolsClient } from "../src/lib/business-tools-client";
import { accessPath, billingLabel, type BusinessToolsAccess } from "../src/lib/business-tools";
import {
  mayContinueToTool,
  paymentCopy,
  paymentError,
  paymentLanguage,
  paymentMoney,
  toolLinkDestination,
} from "../src/lib/business-tools-ui";

const access = (granted: boolean): BusinessToolsAccess => ({
  accessGranted: granted,
  status: "ACTIVE",
  validFrom: null,
  validUntil: null,
  plan: {
    code: "SERVER_OFFER",
    name: "Outils Business",
    billingMode: "ONE_TIME",
    amount: 10,
    currency: "USD",
    purchasesEnabled: false,
    version: 1,
  },
  pendingPurchase: null,
  pricing: { planAmount: 10, legacyCreditAmount: 0, amountDue: granted ? 0 : 10, currency: "USD" },
});
function client(request: (path: string) => Promise<unknown>) {
  return new BusinessToolsClient({
    accountKey: "account-A",
    request,
    storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    onGranted: () => {},
  });
}
test("contextual tool links retain only known internal destinations and leave the rest of the app usable", () => {
  assert.equal(toolLinkDestination("/stores/42"), "/stores/42");
  assert.equal(
    toolLinkDestination("/payment-requests?new=1&returnTo=https://foreign.example"),
    "/payment-requests?new=1",
  );
  assert.equal(toolLinkDestination("/pos?store=42"), "/pos?store=42");
  assert.equal(toolLinkDestination("/developers"), "/developers");
  for (const href of [
    "/overview",
    "/settings",
    "/login",
    "/market",
    "/checkout",
    "https://foreign.example/stores",
    "//foreign.example/stores",
  ])
    assert.equal(toolLinkDestination(href), undefined);
});
test("the modal can continue to its remembered tool only after an authoritative access read", async () => {
  let granted = false;
  const paths: string[] = [];
  const tools = client(async (path) => {
    paths.push(path);
    return access(granted);
  });
  await tools.enter("/developers");
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/developers"), false); // ACTIVE status alone never opens it.
  granted = true;
  const read = tools.reload();
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/developers"), false);
  await read;
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/developers"), true); // No purchase record, sales disabled.
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/stores"), false);
  assert.ok(paths.every((path) => path === accessPath));
});
test("a second tool selection supersedes a slower first selection without opening the wrong tool", async () => {
  let finish!: (value: BusinessToolsAccess) => void;
  const response = new Promise<BusinessToolsAccess>((resolve) => {
    finish = resolve;
  });
  const tools = client(() => response);
  const first = tools.enter("/stores");
  const second = tools.enter("/pos?store=4");
  finish(access(true));
  await Promise.all([first, second]);
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/stores"), false);
  assert.equal(mayContinueToTool(tools.getSnapshot(), "/pos?store=4"), true);
  assert.equal(
    mayContinueToTool({ ...tools.getSnapshot(), resourceUnavailable: true }, "/pos?store=4"),
    false,
  );
  assert.equal(
    mayContinueToTool({ ...tools.getSnapshot(), error: "Unavailable" }, "/pos?store=4"),
    false,
  );
  assert.equal(
    mayContinueToTool(
      { ...tools.getSnapshot(), resourceUnavailable: true, resourceUnavailableFor: "/stores/42" },
      "/pos?store=4",
    ),
    true,
  );
});
test("activation labels and full currency units are localized without changing backend values", () => {
  assert.equal(paymentLanguage("fr-FR"), "fr");
  assert.equal(paymentCopy("en").activate, "Activate");
  assert.equal(paymentCopy("fr").activate, "Activer");
  assert.equal(billingLabel("ONE_TIME", "fr"), "Paiement unique");
  assert.match(paymentMoney(10, "USD", "en"), /10\.00/);
  assert.match(paymentMoney(10, "USD", "fr"), /10,00/);
  const french = paymentCopy("fr");
  assert.equal(paymentError(french.insufficient, "fr", french.errorBody), french.insufficient);
  assert.equal(
    paymentError(
      "We couldn’t reach Fondeka. Check your connection and try again.",
      "fr",
      french.errorBody,
    ),
    french.errorBody,
  );
  assert.match(french.unavailableBody, /temporairement indisponible/);
});
