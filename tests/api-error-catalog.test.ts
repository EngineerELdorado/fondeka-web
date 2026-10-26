import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  apiErrorCatalogPath,
  errorCatalogEndpoint,
  parseApiErrorCatalog,
  processingErrorsFor,
  simulationHeaders,
} from "../src/lib/api-error-catalog";
import {
  contractCurl,
  guideHeaders,
  guideRequestBody,
  type GuideSpec,
} from "../src/lib/api-guide-contract";
import { guideTrack } from "../src/lib/api-guide-content";
import { demoRequest } from "../src/lib/demo";
import { uiText } from "../src/lib/ui-copy";

const raw = JSON.parse(readFileSync("public/docs/business-api/openapi.v1.json", "utf8"));
const spec = raw as GuideSpec;
const response =
  raw.paths["/business-api/v1/businesses/{businessId}/error-codes"].get.responses["200"].content[
    "*/*"
  ].examples.sandbox.value;
const catalog = parseApiErrorCatalog(response, "SANDBOX");
const collection = errorCatalogEndpoint(
  catalog,
  "POST",
  "/business-api/v1/businesses/{businessId}/collections",
  "createCollection",
)!;
const payout = errorCatalogEndpoint(
  catalog,
  "POST",
  "/business-api/v1/businesses/{businessId}/payouts",
)!;

test("catalog parsing validates environment, header, error stages and distinct operation identities", () => {
  assert.equal(catalog.endpoints.length, 9);
  assert.throws(() => parseApiErrorCatalog(response, "LIVE"));
  for (const bad of [
    null,
    {},
    { ...response, simulationHeader: "X-Other" },
    { ...response, endpoints: [collection, collection] },
    {
      ...response,
      endpoints: [
        { ...collection, requestErrors: [{ ...collection.requestErrors[0], httpStatus: "400" }] },
      ],
    },
    {
      ...response,
      endpoints: [
        {
          ...collection,
          processingErrors: [{ ...collection.processingErrors[0], resultingStatus: "UNKNOWN" }],
        },
      ],
    },
  ])
    assert.throws(() => parseApiErrorCatalog(bad, "SANDBOX"));
  assert.deepEqual(parseApiErrorCatalog({ ...response, endpoints: [] }, "SANDBOX").endpoints, []);
  assert.equal(errorCatalogEndpoint(catalog, "GET", collection.path), undefined);
  assert.equal(errorCatalogEndpoint(catalog, "POST", collection.path, "wrong-id"), collection);
  assert.notEqual(apiErrorCatalogPath(42, "LIVE"), apiErrorCatalogPath(42, "SANDBOX"));
  assert.match(apiErrorCatalogPath(42), /environment=LIVE$/);
  assert.throws(() => apiErrorCatalogPath(-1));
});

test("processing errors are payment-only and approval/payer-balance fixtures remain mobile-money collection-only", () => {
  assert.ok(
    processingErrorsFor(collection, "MOBILE_MONEY").some(
      (error) => error.errorCode === "PAYMENT_NOT_APPROVED",
    ),
  );
  assert.ok(
    processingErrorsFor(collection, "MOBILE_MONEY").some(
      (error) => error.errorCode === "PAYER_INSUFFICIENT_FUNDS",
    ),
  );
  for (const endpoint of [collection, payout])
    for (const kind of ["MOBILE_MONEY", "CRYPTO"] as const) {
      if (endpoint === collection && kind === "MOBILE_MONEY") continue;
      assert.ok(
        processingErrorsFor(endpoint, kind).every(
          (error) =>
            !["PAYMENT_NOT_APPROVED", "PAYER_INSUFFICIENT_FUNDS"].includes(error.errorCode),
        ),
      );
    }
  const malicious = { ...payout, processingErrors: collection.processingErrors };
  assert.ok(
    processingErrorsFor(malicious, "MOBILE_MONEY").every(
      (error) => error.errorCode !== "PAYMENT_NOT_APPROVED",
    ),
  );
  const lookup = errorCatalogEndpoint(
    catalog,
    "GET",
    "/business-api/v1/businesses/{businessId}/transactions/{reference}",
  )!;
  assert.deepEqual(
    processingErrorsFor(
      { ...lookup, processingErrors: collection.processingErrors },
      "MOBILE_MONEY",
    ),
    [],
  );
});

test("crypto catalog outcomes remain operation-specific and include persistent PROCESSING", () => {
  const expected = [
    [
      collection,
      ["CRYPTO_INVOICE_EXPIRED", "CRYPTO_NETWORK_UNAVAILABLE", "CRYPTO_CONFIRMATIONS_PENDING"],
    ],
    [
      payout,
      [
        "CRYPTO_ADDRESS_INVALID",
        "CRYPTO_NETWORK_UNAVAILABLE",
        "CRYPTO_TRANSFER_REJECTED",
        "CRYPTO_CONFIRMATIONS_PENDING",
      ],
    ],
  ] as const;
  for (const [endpoint, codes] of expected) {
    const entries = processingErrorsFor(endpoint, "CRYPTO");
    assert.deepEqual(
      entries
        .filter((entry) => entry.errorCode.startsWith("CRYPTO_"))
        .map((entry) => entry.errorCode),
      codes,
    );
    for (const code of [
      "INVALID_DESTINATION",
      "PROVIDER_UNAVAILABLE",
      "PAYMENT_EXPIRED",
      "PAYMENT_CANCELLED",
    ])
      assert.ok(entries.some((entry) => entry.errorCode === code));
    const pending = entries.find((entry) => entry.errorCode === "CRYPTO_CONFIRMATIONS_PENDING")!;
    assert.equal(pending.resultingStatus, "PROCESSING");
    assert.deepEqual(
      simulationHeaders(
        catalog,
        endpoint,
        { stage: "processing", errorCode: pending.errorCode },
        "CRYPTO",
      ),
      {
        "X-Simulate-Error-Code": pending.simulationValue,
      },
    );
    assert.ok(
      processingErrorsFor(endpoint, "MOBILE_MONEY").every(
        (entry) => !entry.errorCode.startsWith("CRYPTO_"),
      ),
    );
  }
  const combined = [...collection.processingErrors, ...payout.processingErrors].map((entry) => ({
    ...entry,
    paymentMethodTypes: ["CRYPTO", "MOBILE_MONEY"],
  }));
  for (const [endpoint, codes] of expected) {
    const mixed = { ...endpoint, processingErrors: combined };
    const allowed = new Set(codes);
    assert.ok(
      processingErrorsFor(mixed, "CRYPTO")
        .filter((entry) => entry.errorCode.startsWith("CRYPTO_"))
        .every((entry) => allowed.has(entry.errorCode as (typeof codes)[number])),
    );
    assert.ok(
      processingErrorsFor(mixed, "MOBILE_MONEY").every(
        (entry) => !entry.errorCode.startsWith("CRYPTO_"),
      ),
    );
  }
});

test("older catalogs still parse and new crypto codes are unavailable unless advertised", () => {
  const previous = {
    ...collection,
    processingErrors: collection.processingErrors.filter(
      (entry) => !entry.errorCode.startsWith("CRYPTO_"),
    ),
  };
  const older = parseApiErrorCatalog({ ...response, endpoints: [previous] }, "SANDBOX");
  assert.deepEqual(
    simulationHeaders(
      older,
      previous,
      { stage: "processing", errorCode: "CRYPTO_CONFIRMATIONS_PENDING" },
      "CRYPTO",
    ),
    {},
  );
  for (const endpoint of [collection, payout])
    assert.deepEqual(
      simulationHeaders(
        catalog,
        endpoint,
        {
          stage: "processing",
          errorCode:
            endpoint === collection ? "CRYPTO_TRANSFER_REJECTED" : "CRYPTO_INVOICE_EXPIRED",
        },
        "CRYPTO",
      ),
      {},
    );
});

test("crypto examples retain fiat pricing, destinations and the same accepted intent on pending retries", () => {
  for (const [id, endpoint] of [
    ["crypto-collection", collection],
    ["crypto-payout", payout],
  ] as const) {
    const example = guideTrack(id).lessons[0].example!;
    const body = guideRequestBody(spec, example) as Record<string, unknown>;
    assert.equal(body.amount, 10);
    assert.equal(body.currency, "USD");
    assert.equal(body.paymentMethodName, "USDT");
    assert.equal(body.networkName, "TRC20");
    if (endpoint === payout) assert.equal(typeof body.accountRef, "string");
    const headers = {
      ...simulationHeaders(
        catalog,
        endpoint,
        { stage: "processing", errorCode: "CRYPTO_CONFIRMATIONS_PENDING" },
        "CRYPTO",
      ),
      "Idempotency-Key": "original-accepted-crypto-intent",
    };
    const curl = contractCurl(spec, example, body, headers);
    assert.match(curl, /X-Simulate-Error-Code: CRYPTO_CONFIRMATIONS_PENDING/);
    assert.match(curl, /Idempotency-Key: original-accepted-crypto-intent/);
    assert.equal(curl, contractCurl(spec, example, body, headers));
    assert.equal(Object.hasOwn(body, "failureCode"), false);
    assert.doesNotMatch(contractCurl(spec, example, body), /X-Simulate-Error-Code/);
  }
});

test("simulation uses the returned value only when the environment, endpoint and entry permit it", () => {
  const choice = { stage: "request", errorCode: "INSUFFICIENT_FUNDS" } as const;
  assert.deepEqual(simulationHeaders(catalog, payout, choice, "MOBILE_MONEY"), {
    "X-Simulate-Error-Code": "INSUFFICIENT_FUNDS",
  });
  assert.deepEqual(simulationHeaders(catalog, payout), {});
  assert.deepEqual(simulationHeaders({ ...catalog, environment: "LIVE" }, payout, choice), {});
  assert.deepEqual(simulationHeaders({ ...catalog, simulationEnabled: false }, payout, choice), {});
  assert.deepEqual(simulationHeaders(catalog, { ...payout, available: false }, choice), {});
  assert.deepEqual(
    simulationHeaders(catalog, payout, { stage: "request", errorCode: "INVALID_TEST_ERROR_CODE" }),
    {},
  );
  assert.deepEqual(
    simulationHeaders(
      catalog,
      payout,
      { stage: "processing", errorCode: "PAYMENT_NOT_APPROVED" },
      "MOBILE_MONEY",
    ),
    {},
  );
  const entry = payout.requestErrors.find((error) => error.errorCode === choice.errorCode)!;
  assert.deepEqual(
    simulationHeaders(
      catalog,
      { ...payout, requestErrors: [{ ...entry, simulationValue: "CUSTOM_SIMULATION_VALUE" }] },
      choice,
    ),
    { "X-Simulate-Error-Code": "CUSTOM_SIMULATION_VALUE" },
  );
  for (const value of ["SUCCESS", "PENDING"])
    assert.deepEqual(
      simulationHeaders(
        catalog,
        { ...payout, requestErrors: [{ ...entry, simulationValue: value }] },
        choice,
      ),
      {},
    );
});

test("copied examples omit all simulation by default and retain an explicit accepted retry intent", () => {
  const example = guideTrack("mobile-money-collection").lessons[0].example!;
  const body = guideRequestBody(spec, example);
  const normal = contractCurl(spec, example, body);
  assert.doesNotMatch(normal, /X-Simulate|X-Fondeka-Test-Scenario/);
  assert.match(normal, /MPESA_DRC/);
  const headers = {
    ...simulationHeaders(
      catalog,
      collection,
      { stage: "processing", errorCode: "PAYMENT_NOT_APPROVED" },
      "MOBILE_MONEY",
    ),
    "Idempotency-Key": "original-accepted-intent",
  };
  const first = contractCurl(spec, example, body, headers);
  assert.equal(first, contractCurl(spec, example, body, headers));
  assert.match(first, /X-Simulate-Error-Code: PAYMENT_NOT_APPROVED/);
  assert.match(first, /Idempotency-Key: original-accepted-intent/);
  assert.equal(guideHeaders(raw.paths[example.path].post)["X-Simulate-Error-Code"], undefined);
  const insufficient = payout.requestErrors.find(
    (error) => error.errorCode === "INSUFFICIENT_FUNDS",
  )!;
  assert.equal(insufficient.httpStatus, 400);
  const approval = collection.processingErrors.find(
    (error) => error.errorCode === "PAYMENT_NOT_APPROVED",
  )!;
  assert.equal(approval.resultingStatus, "FAILED");
});

test("every current catalog description and testing instruction has French copy", () => {
  for (const endpoint of catalog.endpoints) {
    for (const error of [...endpoint.requestErrors, ...endpoint.processingErrors]) {
      assert.notEqual(uiText(error.description, "fr"), error.description);
      if ("howToTest" in error) assert.notEqual(uiText(error.howToTest, "fr"), error.howToTest);
    }
  }
});

test("the fictional demo returns matching LIVE/SANDBOX catalogs and rejects foreign Businesses or environments", async () => {
  for (const environment of ["LIVE", "SANDBOX"] as const) {
    const result = parseApiErrorCatalog(
      await demoRequest(apiErrorCatalogPath(1, environment)),
      environment,
    );
    assert.equal(result.simulationEnabled, environment === "SANDBOX");
    const crypto = result.endpoints.find(
      (endpoint) => endpoint.operationId === "createCollection",
    )!;
    const pending = processingErrorsFor(crypto, "CRYPTO").find(
      (entry) => entry.errorCode === "CRYPTO_CONFIRMATIONS_PENDING",
    )!;
    assert.equal(pending.resultingStatus, "PROCESSING");
    assert.equal(pending.simulatable, environment === "SANDBOX");
    assert.equal(pending.simulationValue, environment === "SANDBOX" ? pending.errorCode : null);
    assert.ok(
      result.endpoints
        .filter((endpoint) => endpoint.path.includes("/sandbox-wallets/"))
        .every((endpoint) => endpoint.available === (environment === "SANDBOX")),
    );
  }
  await assert.rejects(
    demoRequest(apiErrorCatalogPath(2, "SANDBOX")),
    (error: { status?: number }) => error.status === 404,
  );
  await assert.rejects(
    demoRequest("/customer-api/businesses/1/api-error-codes?environment=invalid"),
    (error: { status?: number }) => error.status === 400,
  );
});
