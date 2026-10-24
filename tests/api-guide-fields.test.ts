import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  guideSchemaFields,
  guideSchemaStructure,
  guidePageFields,
  guideFieldDescription,
  guideCodePaths,
} from "../src/lib/api-guide-fields";
import {
  guideMedia,
  guideOperation,
  publishedExample,
  type GuideSpec,
} from "../src/lib/api-guide-contract";
import { guideTrack } from "../src/lib/api-guide-content";

const spec = JSON.parse(
  readFileSync("public/docs/business-api/openapi.v1.json", "utf8"),
) as GuideSpec;
const fields = (name: string) =>
  guideSchemaFields(spec, { $ref: `#/components/schemas/${name}` }, "response");

test("collection and payout guides explain sandbox error simulation and LIVE ignores the header", () => {
  for (const id of [
    "mobile-money-collection",
    "mobile-money-payout",
    "crypto-collection",
    "crypto-payout",
  ]) {
    const example = guideTrack(id).lessons[0].example!;
    const parameter = guideOperation(spec, example).parameters!.find(
      (p) => p.name === "X-Simulate-Error-Code",
    )!;
    assert.match(parameter.description!, /LIVE credentials ignore/);
    assert.equal(parameter.schema.enum, undefined); // Unknown strings remain valid in LIVE.
    for (const language of ["en", "fr"]) {
      const description = guideFieldDescription(
        {
          name: parameter.name,
          path: parameter.name,
          depth: 0,
          location: "header",
          required: false,
          schema: { ...parameter.schema, description: parameter.description },
        },
        language,
        example,
      );
      assert.equal(description.language, language);
      assert.match(
        description.text,
        id === "mobile-money-collection" ? /PAYMENT_NOT_APPROVED/ : /PROVIDER_UNAVAILABLE/,
      );
      assert.match(description.text, /FAILED/);
      assert.match(description.text, /SANDBOX/);
      assert.match(description.text, /LIVE/);
      assert.match(description.text, language === "en" ? /ignores/ : /ignore/);
    }
  }
});

test("every declared request and response property has an English and French explanation", () => {
  for (const name of Object.keys(spec.components.schemas)) {
    for (const field of fields(name)) {
      for (const language of ["en", "fr"]) {
        const description = guideFieldDescription(field, language);
        assert.ok(description.text.trim().length > 10, `${name}.${field.path}: ${language}`);
        assert.equal(description.language, language, `${name}.${field.path}: untranslated`);
      }
    }
  }
});

test("crypto response structure retains the entire transaction around the expanded cryptoDetails object", () => {
  for (const id of ["crypto-collection", "crypto-payout"]) {
    const example = guideTrack(id).lessons[0].example!;
    const operation = guideOperation(spec, example);
    const schema = guideMedia(operation.responses["202"].content)?.schema;
    const structure = guideSchemaStructure(spec, schema) as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(structure),
      Object.keys(spec.components.schemas.BusinessApiTransactionResource.properties!),
    );
    assert.equal(structure.reference, "string");
    assert.equal(structure.businessId, "integer");
    assert.equal(structure.status, "string");
    assert.equal(structure.amount, "number");
    assert.equal(structure.currency, "string");
    assert.equal(structure.refunded, "boolean");
    assert.equal(structure.transactionId, "integer | null");
    const crypto = structure.cryptoDetails as Record<string, unknown>;
    assert.deepEqual(
      Object.keys(crypto),
      Object.keys(spec.components.schemas.CryptoDetails.properties!),
    );
    assert.equal(crypto.address, "string | null");
    assert.equal(crypto.amountInCrypto, "number | null");
    assert.equal(crypto.network, "string | null");
    const published = publishedExample(guideMedia(operation.responses["202"].content)) as Record<
      string,
      unknown
    >;
    assert.equal(published.cryptoDetails, null);
  }
});

test("the shared schema remains complete independently of the guide-specific field selection", () => {
  const example = guideTrack("crypto-collection").lessons[0].example!;
  const operation = guideOperation(spec, example);
  const request = guideSchemaFields(
    spec,
    guideMedia(operation.requestBody?.content)?.schema,
    "body",
  );
  assert.deepEqual(
    request.map((field) => field.path).sort(),
    [
      "accountRef",
      "amount",
      "clientReference",
      "currency",
      "feeApplicationMode",
      "networkId",
      "networkName",
      "paymentMethodId",
      "paymentMethodName",
    ].sort(),
  );
  assert.equal(request.find((field) => field.name === "amount")?.required, true);
  assert.equal(request.find((field) => field.name === "accountRef")?.required, false);
});

test("each payment page explains exactly its own request payload and keeps its published method fixed", () => {
  for (const id of [
    "mobile-money-collection",
    "mobile-money-payout",
    "crypto-collection",
    "crypto-payout",
  ]) {
    const example = guideTrack(id).lessons[0].example!;
    const media = guideMedia(guideOperation(spec, example).requestBody?.content);
    const body = publishedExample(media, example.exampleName) as Record<string, unknown>;
    const scoped = guidePageFields(guideSchemaFields(spec, media?.schema, "body"), example, body);
    assert.deepEqual(scoped.map((field) => field.path).sort(), Object.keys(body).sort(), id);
    assert.equal(body.paymentMethodName, id.startsWith("crypto") ? "USDT" : "MPESA_KENYA");
    assert.ok(!scoped.some((field) => ["networkId", "paymentMethodId"].includes(field.path)), id);
    assert.equal(scoped.find((field) => field.name === "paymentMethodName")?.required, true);
    if (id.startsWith("mobile-money"))
      assert.ok(!scoped.some((field) => field.name.startsWith("network")), id);
    if (id === "crypto-collection") assert.ok(!scoped.some((field) => field.name === "accountRef"));
    else assert.equal(scoped.find((field) => field.name === "accountRef")?.required, true);
    if (id.startsWith("crypto"))
      assert.equal(scoped.find((field) => field.name === "networkName")?.required, true);
  }
});

test("mobile-money responses explain the null cryptoDetails field without unrelated crypto children", () => {
  for (const id of [
    "mobile-money-collection",
    "mobile-money-payout",
    "crypto-collection",
    "crypto-payout",
  ]) {
    const example = guideTrack(id).lessons[0].example!;
    const scoped = guidePageFields(fields("BusinessApiTransactionResource"), example);
    assert.equal(scoped.length, id.startsWith("crypto") ? 28 : 20, id);
    const confirmation = guideTrack(id).lessons.find(
      (lesson) => lesson.confirmation,
    )!.confirmation!;
    const webhook = guidePageFields(fields("BusinessApiWebhookEvent"), confirmation.webhook);
    assert.equal(webhook.length, id.startsWith("crypto") ? 33 : 25, id);
    if (id.startsWith("mobile-money")) {
      assert.ok(!scoped.some((field) => field.path.startsWith("cryptoDetails.")));
      assert.match(
        guideFieldDescription(
          scoped.find((field) => field.name === "cryptoDetails")!,
          "en",
          example,
        ).text,
        /null for mobile-money/,
      );
    }
  }
});

test("accountRef explanations follow the current payment guide rather than the shared request schema", () => {
  for (const [id, meaning, excluded] of [
    ["mobile-money-collection", /payer.*international phone number/i, /recipient|crypto address/i],
    ["mobile-money-payout", /recipient.*mobile-money phone number/i, /payer|crypto address/i],
    ["crypto-payout", /recipient.*crypto address on networkName/i, /phone|payer/i],
    ["crypto-collection", /not required.*cryptoDetails\.address/i, /phone|recipient/i],
  ] as const) {
    const example = guideTrack(id).lessons[0].example!;
    const field = guideSchemaFields(
      spec,
      guideMedia(guideOperation(spec, example).requestBody?.content)?.schema,
      "body",
    ).find((field) => field.name === "accountRef")!;
    const description = guideFieldDescription(field, "en", example);
    assert.match(description.text, meaning, id);
    assert.doesNotMatch(description.text, excluded, id);
    assert.equal(guideFieldDescription(field, "fr", example).language, "fr");
  }
});

test("responses enumerate nullable crypto details, nested wallet objects and every webhook payment field", () => {
  const payment = fields("BusinessApiTransactionResource");
  for (const name of Object.keys(spec.components.schemas.CryptoDetails.properties!))
    assert.ok(
      payment.some((field) => field.path === `cryptoDetails.${name}`),
      name,
    );
  assert.equal(payment.length, 28);
  const event = fields("BusinessApiWebhookEvent");
  assert.equal(event.length, 33);
  assert.ok(event.some((field) => field.path === "data.cryptoDetails.exchangeRateCurrency"));
  assert.equal(event.find((field) => field.path === "data.status")?.required, true);
  const conversion = fields("Conversion");
  assert.equal(conversion.length, 19);
  assert.ok(conversion.some((field) => field.path === "sourceWallet.balance"));
  assert.ok(conversion.some((field) => field.path === "targetWallet.balance"));
});

test("array responses include item fields and complete page metadata without guessing free-form keys", () => {
  const entries = fields("PagedModelEntry");
  assert.equal(entries.length, 17);
  for (const path of [
    "content[].amount",
    "content[].balanceAfter",
    "content[].sequence",
    "page.number",
    "page.size",
    "page.totalElements",
    "page.totalPages",
  ])
    assert.ok(
      entries.some((field) => field.path === path),
      path,
    );
  const wallets = guideSchemaFields(
    spec,
    { type: "array", items: { $ref: "#/components/schemas/Balance" } },
    "response",
  );
  assert.deepEqual(
    wallets.map((field) => field.path),
    ["[].balance", "[].currency", "[].environment"],
  );
  assert.equal(fields("BusinessApiError").length, 10);
  assert.ok(!fields("BusinessApiError").some((field) => field.path === "details.fieldErrors"));
});

test("recursive schema references are bounded while retaining the declared reference field", () => {
  const cyclic = {
    ...spec,
    components: {
      ...spec.components,
      schemas: {
        Node: {
          type: "object",
          properties: { value: { type: "string" }, next: { $ref: "#/components/schemas/Node" } },
        },
      },
    },
  } as GuideSpec;
  assert.deepEqual(
    guideSchemaFields(cyclic, { $ref: "#/components/schemas/Node" }, "body").map(
      (field) => field.path,
    ),
    ["value", "next"],
  );
});

test("payload highlighting distinguishes repeated names and addresses array items by their full path", () => {
  const code = JSON.stringify(
    {
      sourceWallet: { currency: "USD" },
      targetWallet: { currency: "CDF" },
      content: [{ amount: 1 }, { amount: 2 }],
    },
    null,
    2,
  );
  const paths = guideCodePaths(code);
  const currencyLines = code
    .split("\n")
    .flatMap((line, index) => (line.includes('"currency":') ? [index] : []));
  assert.deepEqual(
    currencyLines.map((line) => paths[line]),
    ["sourceWallet.currency", "targetWallet.currency"],
  );
  assert.equal(paths.filter((path) => path === "content[].amount").length, 2);
  assert.deepEqual(guideCodePaths('curl -X GET "https://api.fondeka.com"'), []);
});
