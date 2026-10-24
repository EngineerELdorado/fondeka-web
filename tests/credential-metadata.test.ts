import { test } from "node:test";
import assert from "node:assert/strict";
import {
  credentialMetadataResponse,
  replaceCredentialMetadata,
} from "../src/lib/credential-metadata";
import {
  cacheQuery,
  cachedQuery,
  clearQueryCache,
  queryCacheGeneration,
} from "../src/lib/query-cache";
import { apiKeysPath } from "../src/lib/api-environment";

const key = {
  id: 8,
  businessId: 42,
  name: "ERP",
  keyPrefix: "fdk_biz_prefix",
  enabled: true,
  webhookUrl: "https://merchant.example/old",
  createdAt: "2026-10-24T10:00:00Z",
  environment: "LIVE" as const,
};
const unexpected = {
  ...key,
  apiKey: "must-not-cache",
  webhookSecret: "must-not-cache",
  keyHash: "must-not-cache",
  encryptedWebhookSecret: "must-not-cache",
};

test("credential reads cache only active metadata and never unexpected secrets", () => {
  const result = credentialMetadataResponse(apiKeysPath(42, "LIVE"), "GET", [
    unexpected,
    { ...key, id: 9, enabled: false },
  ]);
  assert.deepEqual(result, [key]);
  assert.doesNotMatch(JSON.stringify(result), /must-not-cache|keyHash|webhookSecret|apiKey/);
  assert.throws(() => credentialMetadataResponse(apiKeysPath(43, "LIVE"), "GET", [key]));
  assert.throws(() => credentialMetadataResponse(apiKeysPath(42, "SANDBOX"), "GET", [key]));
  assert.throws(() => credentialMetadataResponse(apiKeysPath(42, "LIVE"), "GET", {}));
  assert.deepEqual(
    credentialMetadataResponse("/customer-api/businesses/42/api-keys", "GET", [key]),
    [key],
  );
});

test("webhook PATCH responses must describe the exact active key and are stripped of secrets", () => {
  const path = "/customer-api/businesses/42/api-keys/8/webhook";
  assert.deepEqual(credentialMetadataResponse(path, "PATCH", unexpected), key);
  for (const invalid of [
    { ...key, id: 9 },
    { ...key, businessId: 43 },
    { ...key, enabled: false },
    null,
  ])
    assert.throws(() => credentialMetadataResponse(path, "PATCH", invalid));
  // Issuance is the single intentional in-memory exception; it must not pass through metadata queries.
  assert.equal(
    credentialMetadataResponse("/customer-api/businesses/42/api-keys", "POST", unexpected),
    unexpected,
  );
});

test("a webhook save replaces only the affected account, Business and environment cache metadata", () => {
  clearQueryCache();
  const live = apiKeysPath(42, "LIVE");
  const sandbox = apiKeysPath(42, "SANDBOX");
  const foreign = apiKeysPath(43, "LIVE");
  for (const account of ["alice", "bob"])
    for (const path of [live, sandbox, foreign])
      cacheQuery(`${account}:${path}:en`, [key], Date.now(), queryCacheGeneration(), path);
  const saved = { ...unexpected, webhookUrl: "https://merchant.example/new" };
  replaceCredentialMetadata("alice", 42, "LIVE", saved, queryCacheGeneration());
  assert.deepEqual(cachedQuery(`alice:${live}:en`), [{ ...key, webhookUrl: saved.webhookUrl }]);
  for (const cacheKey of [`bob:${live}:en`, `alice:${sandbox}:en`, `alice:${foreign}:en`])
    assert.deepEqual(cachedQuery(cacheKey), [key]);
  const generation = queryCacheGeneration();
  clearQueryCache();
  cacheQuery(`alice:${live}:en`, [key], Date.now(), queryCacheGeneration(), live);
  replaceCredentialMetadata("alice", 42, "LIVE", saved, generation);
  assert.deepEqual(cachedQuery(`alice:${live}:en`), [key]);
  clearQueryCache();
});
