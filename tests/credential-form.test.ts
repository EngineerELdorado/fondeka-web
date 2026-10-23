import { test } from "node:test";
import assert from "node:assert/strict";
import { credentialPayload, parseIssuedCredentials } from "../src/lib/credential-form";

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
