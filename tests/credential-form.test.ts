import { test } from "node:test";
import assert from "node:assert/strict";
import {
  credentialPayload,
  parseIssuedCredentials,
  webhookUpdatePayload,
} from "../src/lib/credential-form";

test("editing a webhook submits only its normalized URL and preserves query parameters", () => {
  assert.deepEqual(webhookUpdatePayload(" https://MERCHANT.example:443/new?receiver=2 "), {
    webhookUrl: "https://merchant.example/new?receiver=2",
  });
  for (const url of [
    "",
    " ",
    "not a URL",
    "http://merchant.example",
    "https://user:secret@merchant.example",
    "https://merchant.example:8443",
    "https://merchant.example/#part",
    "https://merchant.example/" + "x".repeat(2048),
  ])
    assert.throws(() => webhookUpdatePayload(url));
});

test("credential form submits only the normalized name and webhook destination", () => {
  assert.deepEqual(credentialPayload(" ERP ", " https://merchant.example/hooks "), {
    name: "ERP",
    webhookUrl: "https://merchant.example/hooks",
    environment: "LIVE",
  });
});
test("sandbox credential creation uses an explicit immutable environment and validates both prefixes", () => {
  assert.deepEqual(credentialPayload(" Development ", "https://merchant.example/test", "SANDBOX"), {
    name: "Development",
    webhookUrl: "https://merchant.example/test",
    environment: "SANDBOX",
  });
  const sandbox = {
    credential: { id: 9, environment: "SANDBOX" },
    apiKey: "fdk_biz_test_" + "s".repeat(43),
    webhookSecret: "whsec_" + "w".repeat(43),
  };
  assert.equal(parseIssuedCredentials(sandbox, "SANDBOX"), sandbox);
  assert.throws(() => parseIssuedCredentials(sandbox, "LIVE"));
  assert.throws(() =>
    parseIssuedCredentials({ ...sandbox, credential: { id: 9, environment: "LIVE" } }, "SANDBOX"),
  );
  assert.throws(() =>
    parseIssuedCredentials({ ...sandbox, apiKey: "fdk_biz_" + "s".repeat(43) }, "SANDBOX"),
  );
  assert.throws(() => parseIssuedCredentials({ ...sandbox, credential: { id: 9 } }, "SANDBOX"));
});
test("issued credentials accept new and legacy keys only in their stored environment", () => {
  for (const [environment, prefixes] of [
    ["LIVE", ["fdk_biz_live_", "fdk_biz_"]],
    ["SANDBOX", ["fdk_biz_sandbox_", "fdk_biz_test_"]],
  ] as const) {
    for (const prefix of prefixes) {
      const issued = {
        credential: { id: 9, environment },
        apiKey: prefix + "a".repeat(43),
        webhookSecret: "whsec_" + "b".repeat(43),
      };
      assert.equal(parseIssuedCredentials(issued, environment), issued);
      assert.throws(() =>
        parseIssuedCredentials(issued, environment === "LIVE" ? "SANDBOX" : "LIVE"),
      );
      assert.throws(() =>
        parseIssuedCredentials({ ...issued, apiKey: prefix + "a".repeat(42) }, environment),
      );
    }
  }
});
test("credential form rejects blank, oversized and insecure destinations", () => {
  for (const name of ["", " ", "x".repeat(101)])
    assert.throws(() => credentialPayload(name, "https://merchant.example/hooks"));
  for (const url of [
    "",
    "invalid",
    "http://merchant.example",
    "https://user:pass@merchant.example/hooks",
    "https://merchant.example:444/hooks",
    "https://merchant.example/hooks#fragment",
    "https://merchant.example/" + "x".repeat(2048),
  ])
    assert.throws(() => credentialPayload("ERP", url));
});
test("one-time display rejects unexpected responses instead of presenting missing secrets as success", () => {
  const issued = {
    credential: { id: 8, name: "ERP", keyPrefix: "fdk_biz_prefix", enabled: true, createdAt: "" },
    apiKey: "fdk_biz_" + "a".repeat(43),
    webhookSecret: "whsec_" + "b".repeat(43),
  };
  assert.equal(parseIssuedCredentials(issued), issued);
  for (const value of [
    null,
    {},
    { message: "Unexpected upstream response" },
    [],
    { ...issued, apiKey: "" },
    { ...issued, webhookSecret: undefined },
    { ...issued, credential: undefined },
  ])
    assert.throws(() => parseIssuedCredentials(value));
});
