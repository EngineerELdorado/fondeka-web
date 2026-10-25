import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  businessApiDocLink,
  businessApiFiles,
  businessApiTopic,
  businessApiTopics,
} from "../src/lib/business-api-docs";
import { businessDestination } from "../src/lib/business-tools";
import { allowedProxyRoute } from "../src/lib/proxy-policy";
import { portalBusinessApiContract } from "../scripts/lib/business-api-publication";

const root = resolve("public/docs/business-api");
const read = (file: string) => readFileSync(resolve(root, file), "utf8");
const spec = JSON.parse(read("openapi.v1.json"));
const release = JSON.parse(read("release.json"));

test("portal publication omits internal IDs from schemas and nested payment examples", () => {
  for (const payment of [
    '{"transactionId":123,"reference":"TX001","refunded":false}',
    '{"reference":"TX001","transactionId":null,"refunded":false}',
    '{"reference":"TX001","refunded":false,"transactionId":null}',
  ]) {
    const source = JSON.stringify(
      {
        properties: {
          reference: { type: "string" },
          transactionId: { type: "integer", nullable: true },
        },
        examples: [JSON.parse(payment), { data: JSON.parse(payment) }],
      },
      null,
      2,
    );
    assert.deepEqual(JSON.parse(portalBusinessApiContract(source)), {
      properties: { reference: { type: "string" } },
      examples: [
        { reference: "TX001", refunded: false },
        { data: { reference: "TX001", refunded: false } },
      ],
    });
    assert.deepEqual(JSON.parse(portalBusinessApiContract(payment)), {
      reference: "TX001",
      refunded: false,
    });
  }
  const unchanged = '{ "reference" : "TX001", "id" : 42, "clientReference" : "order-001" }\n';
  assert.equal(portalBusinessApiContract(unchanged), unchanged);
  for (const file of businessApiFiles) assert.doesNotMatch(read(file), /transactionId/, file);
});

test("published downloads are a complete reviewed release with no extra private files", () => {
  assert.equal(release.version, spec.info.version);
  assert.equal(release.baseUrl, spec.servers[0].url);
  assert.equal(release.apiMajor, "/business-api/v1");
  assert.deepEqual(Object.keys(release.files).sort(), [...businessApiFiles].sort());
  assert.deepEqual(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => resolve(entry.parentPath, entry.name).slice(root.length + 1))
      .sort(),
    [...businessApiFiles, "release.json"].sort(),
  );
  for (const file of businessApiFiles)
    assert.equal(
      createHash("sha256")
        .update(readFileSync(resolve(root, file)))
        .digest("hex"),
      release.files[file],
      file,
    );
});

test("all published guide, source example and contract links resolve within the bundle", () => {
  for (const topic of businessApiTopics) {
    assert.ok(topic.en && topic.fr);
    for (const match of read(topic.file).matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
      const link = businessApiDocLink(topic, match[1]);
      assert.ok(link, `${topic.file}: ${match[1]}`);
    }
  }
  const crypto = businessApiTopic("crypto-collection");
  assert.equal(businessApiDocLink(crypto, "../webhooks.md")?.kind, "topic");
  assert.deepEqual(businessApiDocLink(crypto, "../examples/node/webhook.mjs"), {
    kind: "file",
    href: "/docs/business-api/examples/node/webhook.mjs",
  });
  assert.deepEqual(businessApiDocLink(crypto, "../openapi.v1.json"), {
    kind: "file",
    href: "/docs/business-api/openapi.v1.json",
  });
});

test("documentation links cannot escape the reviewed files, run script URLs or expose arbitrary proxy paths", () => {
  const current = businessApiTopic("quickstart");
  for (const href of [
    "../../.env.local",
    "../business-api.md",
    "/api/backend/customer-api/accounts/my-account",
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "https://user:secret@example.com",
    "quickstart.md?token=secret",
    "%2e%2e/business-api.md",
  ])
    assert.equal(businessApiDocLink(current, href), undefined, href);
  assert.deepEqual(businessApiDocLink(current, "https://api.fondeka.com"), {
    kind: "external",
    href: "https://api.fondeka.com/",
  });
});

test("the downloadable reference exposes merchant-only endpoints and keeps JWT administration outside the contract", () => {
  assert.equal(spec.openapi, "3.0.3");
  assert.equal(spec.servers[0].url, "https://api.fondeka.com");
  assert.equal(Object.keys(spec.paths).length, 9);
  assert.equal(spec.components.securitySchemes["Business API Key"].in, "header");
  assert.equal(spec.components.securitySchemes["Business API Key"].name, "X-API-Key");
  assert.equal(spec.components.securitySchemes["Business API Key"].type, "apiKey");
  for (const path of Object.keys(spec.paths)) {
    assert.match(path, /^\/business-api\/v1\/businesses\/\{businessId\}\//);
    assert.equal(allowedProxyRoute(path.slice(1), "GET"), false);
    assert.equal(allowedProxyRoute(path.slice(1), "POST"), false);
  }
  assert.ok(!/admin-api|customer-api/.test(JSON.stringify(spec.paths)));
});

test("the sandbox Postman download has no saved API key and retains sandbox/intent guards", () => {
  const postman = JSON.parse(read("postman.v1.json"));
  assert.equal(postman.variable.find((entry: { key: string }) => entry.key === "apiKey").value, "");
  const guard = postman.event
    .find((event: { listen: string }) => event.listen === "prerequest")
    .script.exec.join("\n");
  assert.match(guard, /fdk_biz_test_/);
  assert.match(guard, /skipRequest/);
  assert.match(guard, /CHANGE_ME_ONCE_PER_LOGICAL_RUN/);
  assert.equal(postman.auth.type, "apikey");
  const requests = postman.item.map((item: { request: { url: string } }) =>
    item.request.url
      .replace("{{baseUrl}}", "")
      .split("?")[0]
      .replace(/\{\{(businessId|reference)\}\}/g, "{$1}")
      .replace("/sandbox-wallets/USD/entries", "/sandbox-wallets/{currency}/entries"),
  );
  assert.deepEqual([...new Set(requests)].sort(), Object.keys(spec.paths).sort());
});

test("known documentation selections survive access recovery and arbitrary selections/return URLs are discarded", () => {
  for (const topic of businessApiTopics) {
    const destination = businessDestination(
      `/developers?business=42&environment=SANDBOX&guide=1&doc=${topic.id}&returnTo=https://foreign.example`,
    )!;
    const url = new URL(destination, "https://portal.invalid");
    assert.equal(url.pathname, "/developers");
    assert.equal(url.searchParams.get("doc"), topic.id);
    assert.equal(url.searchParams.get("environment"), "SANDBOX");
    assert.equal(url.searchParams.get("business"), "42");
    assert.equal(url.searchParams.has("returnTo"), false);
  }
  assert.equal(businessApiTopic("../../private").id, "overview");
  assert.equal(
    new URL(
      businessDestination("/developers?guide=1&doc=../../private")!,
      "https://portal.invalid",
    ).searchParams.has("doc"),
    false,
  );
});
