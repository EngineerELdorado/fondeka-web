import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apiGuideTracks,
  apiGuideMenuItems,
  apiGuideMenuTracks,
  guideLesson,
  guideTrack,
  parseGuideProgress,
} from "../src/lib/api-guide-content";
import { businessApiTopics, businessApiFiles } from "../src/lib/business-api-docs";
import { businessDestination } from "../src/lib/business-tools";
import { guideCredentialHref } from "../src/lib/api-guide-setup";
import {
  contractCurl,
  guideMedia,
  guideOperation,
  publishedExample,
  resolveGuideSchema,
  paymentStateGroups,
  type GuideSpec,
} from "../src/lib/api-guide-contract";

const spec = JSON.parse(
  readFileSync("public/docs/business-api/openapi.v1.json", "utf8"),
) as GuideSpec;
const examples = apiGuideTracks.flatMap((track) =>
  track.lessons.flatMap((lesson) => [
    ...(lesson.example ? [lesson.example] : []),
    ...(lesson.confirmation ? Object.values(lesson.confirmation) : []),
  ]),
);
test("the payment catalog is discoverable before Go live without becoming a lesson or published guide", () => {
  const index = apiGuideMenuItems.findIndex((item) => item.kind === "catalog");
  assert.ok(index >= 0);
  const catalog = apiGuideMenuItems[index];
  assert.equal(catalog.kind, "catalog");
  assert.equal(catalog.id, "payment-methods");
  assert.deepEqual(catalog.title, ["Available payment methods", "Moyens de paiement disponibles"]);
  assert.equal(apiGuideMenuItems[index + 1]?.id, "go-live");
  assert.equal(apiGuideMenuItems.filter((item) => item.kind === "catalog").length, 1);
  assert.ok(apiGuideMenuTracks.every((track) => track.id !== String(catalog.id)));
  assert.ok(businessApiTopics.every((topic) => topic.id !== String(catalog.id)));
});
test("guide payloads and explanations use the payment reference and omit internal IDs", () => {
  assert.doesNotMatch(JSON.stringify(examples), /transactionId/);
  const example = guideTrack("mobile-money-collection").lessons.find(
    (lesson) => lesson.confirmation,
  )!.confirmation!.lookup;
  assert.match(example.path, /\/transactions\/\{reference\}$/);
  assert.ok(example.fields.some((field) => field.key === "reference"));
});
test("visual guides cover every published merchant endpoint without introducing guessed routes", () => {
  assert.deepEqual(
    apiGuideTracks.map((track) => track.id),
    businessApiTopics.map((topic) => topic.id),
  );
  assert.equal(
    new Set(
      apiGuideTracks.flatMap((track) => track.lessons.map((lesson) => `${track.id}:${lesson.id}`)),
    ).size,
    apiGuideTracks.reduce((total, track) => total + track.lessons.length, 0),
  );
  const routes = new Set(
    examples.filter((example) => !example.incoming).map((example) => example.path),
  );
  assert.deepEqual([...routes].sort(), Object.keys(spec.paths).sort());
  for (const example of examples) {
    const operation = guideOperation(spec, example);
    assert.ok(operation.responses);
    const media = guideMedia(operation.requestBody?.content);
    if (example.exampleName) assert.ok(media?.examples?.[example.exampleName], example.path);
    if (media) assert.notEqual(publishedExample(media, example.exampleName), undefined);
  }
  for (const track of apiGuideTracks)
    for (const lesson of track.lessons)
      assert.equal(
        new URL(
          businessDestination(`/developers/guides?doc=${track.id}&lesson=${lesson.id}`)!,
          "https://portal.invalid",
        ).searchParams.get("lesson"),
        lesson.id,
      );
  assert.equal(
    new URL(
      businessDestination("/developers/guides?doc=quickstart&lesson=https://evil.test")!,
      "https://portal.invalid",
    ).searchParams.has("lesson"),
    false,
  );
  for (const track of apiGuideTracks)
    for (const lesson of track.lessons)
      for (const resource of lesson.resources || [])
        assert.ok(businessApiFiles.includes(resource.file));
});
test("request and response examples are the literal contract values, including error bodies", () => {
  const example = guideTrack("crypto-collection").lessons[0].example!;
  const operation = guideOperation(spec, example);
  const body = publishedExample(guideMedia(operation.requestBody?.content), example.exampleName);
  assert.deepEqual(body, {
    amount: 10,
    clientReference: "crypto-order-0001",
    currency: "USD",
    feeApplicationMode: "EXCLUSIVE",
    networkName: "TRC20",
    paymentMethodName: "USDT",
  });
  const accepted = publishedExample(guideMedia(operation.responses["202"].content)) as Record<
    string,
    unknown
  >;
  assert.equal(accepted.status, "ACCEPTED");
  assert.equal(accepted.environment, "SANDBOX");
  const errorCodes: string[] = [];
  for (const [status, response] of Object.entries(operation.responses)) {
    if (status.startsWith("2")) continue;
    const samples = guideMedia(response.content)?.examples || {};
    assert.ok(Object.keys(samples).length > 0);
    for (const [code, sample] of Object.entries(samples)) {
      const error = sample.value as {
        errorCode: string;
        status: number;
        statusCode: number;
        message: string;
      };
      assert.equal(error.errorCode, code);
      assert.equal(error.status, Number(status));
      assert.equal(error.statusCode, Number(status));
      assert.ok(error.message.length > 0);
      errorCodes.push(code);
    }
  }
  for (const code of [
    "INVALID_REQUEST",
    "INVALID_TEST_ERROR_CODE",
    "AUTHENTICATION_FAILED",
    "IDEMPOTENCY_CONFLICT",
    "PAYMENT_METHOD_NOT_FOUND",
    "CRYPTO_NETWORK_REQUIRED",
    "RATE_LIMITED",
    "CIRCUIT_OPEN",
    "BULKHEAD_FULL",
  ])
    assert.ok(errorCodes.includes(code), code);
  const incoming = examples.find((example) => example.incoming)!;
  const webhook = guideOperation(spec, incoming);
  assert.equal(publishedExample(guideMedia(webhook.responses["200"].content)), undefined);
  assert.equal(contractCurl(spec, incoming, undefined), "");
});
test("collection confirmation offers current-state lookup and a signed event for the same payment", () => {
  const lesson = guideLesson(guideTrack("mobile-money-collection"), "confirmation");
  assert.equal(lesson.example, undefined);
  const confirmation = lesson.confirmation!;
  assert.equal(confirmation.lookup.method, "GET");
  assert.equal(
    confirmation.lookup.path,
    "/business-api/v1/businesses/{businessId}/transactions/{reference}",
  );
  assert.ok(!confirmation.lookup.incoming);
  assert.equal(confirmation.webhook.incoming, true);
  const lookup = guideOperation(spec, confirmation.lookup);
  const event = guideOperation(spec, confirmation.webhook);
  const current = publishedExample(guideMedia(lookup.responses["200"].content)) as Record<
    string,
    unknown
  >;
  const body = publishedExample(guideMedia(event.requestBody?.content)) as {
    type: string;
    environment: string;
    data: Record<string, unknown>;
  };
  assert.equal(body.type, "business_api.collection.completed");
  assert.equal(body.environment, current.environment);
  for (const key of ["reference", "businessId", "status", "currency", "settlementNet"])
    assert.equal(body.data[key], current[key]);
  assert.equal(body.data.status, "COMPLETED");
  assert.ok(event.parameters?.some((header) => header.name === "X-Fondeka-Signature"));
  assert.equal(contractCurl(spec, confirmation.webhook, body), "");
});
test("all payment guides share lookup/webhook confirmation and distinguish payout events from the published collection sample", () => {
  for (const id of [
    "mobile-money-collection",
    "mobile-money-payout",
    "crypto-collection",
    "crypto-payout",
  ]) {
    const confirmation = guideTrack(id).lessons.find((lesson) => lesson.confirmation)?.confirmation;
    assert.ok(confirmation, id);
    const payout = id.endsWith("payout");
    assert.equal(
      confirmation.lookup.paymentAction,
      payout ? "BUSINESS_API_PAYOUT" : "BUSINESS_API_COLLECTION",
    );
    assert.equal(confirmation.webhook.paymentAction, confirmation.lookup.paymentAction);
    const resource = resolveGuideSchema(spec, {
      $ref: "#/components/schemas/BusinessApiTransactionResource",
    });
    assert.ok(resource.properties?.action.enum?.includes(confirmation.lookup.paymentAction!));
    const event = resolveGuideSchema(spec, {
      $ref: "#/components/schemas/BusinessApiWebhookEvent",
    });
    for (const outcome of ["completed", "failed"])
      assert.ok(
        event.properties?.type.enum?.includes(
          `business_api.${payout ? "payout" : "collection"}.${outcome}`,
        ),
      );
    const sample = publishedExample(
      guideMedia(guideOperation(spec, confirmation.webhook).requestBody?.content),
    ) as { type: string };
    assert.equal(sample.type, "business_api.collection.completed");
  }
  assert.ok(
    guideTrack("crypto-collection").lessons.find((lesson) => lesson.id === "instructions")?.example,
  );
});
test("schema exploration resolves references, nullable nested crypto fields and alternative required methods", () => {
  const request = resolveGuideSchema(spec, {
    $ref: "#/components/schemas/BusinessApiTransactionRequest",
  });
  assert.deepEqual(request.required, ["amount", "currency"]);
  assert.equal(request.properties?.amount.multipleOf, 0.01);
  assert.deepEqual(
    request.anyOf?.flatMap((part) => part.required || []),
    ["paymentMethodName", "paymentMethodId"],
  );
  const payment = resolveGuideSchema(spec, {
    $ref: "#/components/schemas/BusinessApiTransactionResource",
  });
  const crypto = resolveGuideSchema(spec, payment.properties?.cryptoDetails);
  assert.equal(crypto.nullable, true);
  assert.equal(crypto.properties?.amountInCrypto.type, "number");
  assert.ok(crypto.properties?.network.description);
  assert.deepEqual(
    Object.keys(crypto.properties || {}).sort(),
    [
      "address",
      "amountInCrypto",
      "cryptoCurrency",
      "exchangeRate",
      "exchangeRateCurrency",
      "expiresAt",
      "invoiceUrl",
      "network",
    ].sort(),
  );
  assert.equal(crypto.properties?.exchangeRateCurrency.type, "string");
  for (const id of ["crypto-collection", "crypto-payout"])
    assert.equal(guideTrack(id).lessons[0].example?.responseFocus, "cryptoDetails");
  assert.equal(
    guideLesson(guideTrack("crypto-collection"), "instructions").example?.responseFocus,
    "cryptoDetails",
  );
  const payoutAddress = guideTrack("crypto-payout").lessons[0].example?.fields.find(
    (field) => field.key === "accountRef",
  );
  assert.match(payoutAddress!.note[0], /recipient’s crypto address on networkName/);
  assert.deepEqual(
    [...paymentStateGroups.flatMap((group) => group.states)].sort(),
    [...payment.properties!.status.enum!].sort(),
  );
});
test("copyable cURL uses server-side placeholders and documented headers; GETs gain no invented body", () => {
  const example = guideTrack("mobile-money-collection").lessons[0].example!;
  const operation = guideOperation(spec, example);
  const body = publishedExample(guideMedia(operation.requestBody?.content), example.exampleName);
  const curl = contractCurl(spec, example, body);
  assert.match(
    curl,
    /https:\/\/api\.fondeka\.com\/business-api\/v1\/businesses\/\$FONDEKA_BUSINESS_ID\/collections/,
  );
  assert.match(curl, /X-API-Key: \$FONDEKA_API_KEY/);
  assert.match(curl, /Idempotency-Key: order-0001-collect/);
  assert.ok(curl.endsWith(`--data '${JSON.stringify(body, null, 2)}'`));
  assert.doesNotMatch(
    contractCurl(spec, guideTrack("concepts").lessons[0].example!, undefined),
    /--data|Content-Type/,
  );
});
test("learning progress rejects corrupt or unknown data and route steps cannot escape a known guide", () => {
  assert.deepEqual(parseGuideProgress('{"apiKey":"secret"}'), []);
  assert.deepEqual(parseGuideProgress("not-json"), []);
  assert.deepEqual(
    parseGuideProgress(
      '["quickstart:setup","quickstart:setup","quickstart:collect","https://evil.test",null,"other-account"]',
    ),
    ["quickstart:setup"],
  );
  const track = guideTrack("quickstart");
  assert.equal(guideLesson(track, "https://evil.test"), track.lessons[0]);
  assert.equal(guideTrack("https://evil.test").id, "overview");
});
test("Quickstart prepares credentials without embedding payment execution; its creation link requires a valid Business ID", () => {
  const quickstart = guideTrack("quickstart");
  assert.equal(quickstart.lessons.length, 1);
  assert.equal(quickstart.lessons[0].id, "setup");
  assert.equal(quickstart.lessons[0].example, undefined);
  assert.equal(guideTrack("overview").lessons[0].example, undefined);
  for (const id of [undefined, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(guideCredentialHref(id), undefined);
  const destination = businessDestination(guideCredentialHref(42)!);
  const url = new URL(destination!, "https://portal.invalid");
  assert.equal(url.pathname, "/developers");
  assert.equal(url.searchParams.get("business"), "42");
  assert.equal(url.searchParams.get("environment"), "SANDBOX");
  assert.equal(url.searchParams.get("createKey"), "1");
});
