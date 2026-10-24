# Error codes and sandbox simulation

Use `statusCode` (and `status`) for the HTTP status, and a meaningful business code to decide what to do. Do not branch on `message` text.

| Stage | Where the code appears | Meaning |
| --- | --- | --- |
| Request rejected | HTTP error body `errorCode` | The request was not accepted. Examples: `INSUFFICIENT_FUNDS`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_METHOD_UNAVAILABLE`. |
| Accepted payment fails during processing | Payment `failureCode` in GET responses and terminal webhook `data` | The payment was accepted but later failed. Examples: `PAYMENT_NOT_APPROVED`, `INVALID_DESTINATION`, `PROVIDER_UNAVAILABLE`. |

HTTP 202 is acceptance, not completion. The public payment status is `ACCEPTED`, `PROCESSING`, `COMPLETED` or `FAILED`. Polling a failed payment still returns HTTP 200: inspect `status` and `failureCode`.

## Discover errors for an endpoint

```http
GET /business-api/v1/businesses/{businessId}/error-codes
X-API-Key: <business-api-key>
```

The key determines LIVE or SANDBOX. The response contains:

| Field | Handling |
| --- | --- |
| `environment` | The authenticated key's environment. |
| `simulationHeader` | `X-Simulate-Error-Code`. |
| `simulationEnabled` | True only for SANDBOX. |
| `endpoints` | Select by `operationId`, or `method` and `path`. |
| `endpoints[].available` | Sandbox wallet operations are unavailable to LIVE keys. |
| `endpoints[].additionalRequestErrorsPossible` | LIVE payment policies/configuration may return additional errors. Keep fallback handling for unknown codes. |
| `endpoints[].requestErrors` | Immediate errors with `httpStatus`, `errorCode`, `description`, `howToTest`, `simulatable` and `simulationValue`. |
| `endpoints[].processingErrors` | Deferred sandbox payment fixtures with `errorCode`, `description`, `resultingStatus`, `paymentMethodTypes`, `simulatable` and `simulationValue`. The terminal payment uses this code as `failureCode`. |

Only select entries with `simulatable: true`. Submit their `simulationValue` unchanged in the advertised header. An endpoint has no processing errors unless it starts a collection or payout. The catalog describes supported sandbox processing fixtures; LIVE provider failure coverage is not exhaustive and failure details may be absent.

The authenticated web portal catalog returns the same metadata. The [OpenAPI reference](openapi.v1.json) includes `x-error-codes`, `x-processing-errors`, `x-simulatable-error-codes`, response examples and the optional header on each merchant endpoint.

## Immediate rejection

For a sandbox payout, add:

```http
X-Simulate-Error-Code: INSUFFICIENT_FUNDS
```

After real authentication, Business ownership and access checks, the API returns HTTP 400:

```json
{
  "message": "The owner's wallet cannot cover the debit including applicable fees.",
  "status": 400,
  "statusCode": 400,
  "errorCode": "INSUFFICIENT_FUNDS",
  "requestId": "22222222-2222-4222-8222-222222222222",
  "details": { "simulated": true }
}
```

No payment is created, no wallet is changed, no idempotency key is reserved and no webhook is generated. Other examples include HTTP 409 `IDEMPOTENCY_CONFLICT`, HTTP 404 `PAYMENT_NOT_FOUND` on payment lookup, and HTTP 429 `RATE_LIMITED`. Use the endpoint's catalog for allowed codes and statuses. Real production errors/timeouts can have an uncertain outcome; retain normal reconciliation and retry rules even though these sandbox request rejections have no side effects.

## Failure after payment acceptance

For a customer who does not approve mobile money collection:

```http
POST /business-api/v1/businesses/42/collections
X-API-Key: fdk_biz_test_<secret>
Idempotency-Key: order-unapproved-001
X-Simulate-Error-Code: PAYMENT_NOT_APPROVED
Content-Type: application/json

{
  "amount": 10.00,
  "currency": "USD",
  "paymentMethodName": "MPESA_KENYA",
  "accountRef": "+254707371664",
  "clientReference": "order-unapproved-001"
}
```

1. Normal payload, quota, access and wallet validations run.
2. HTTP 202 returns an accepted payment with `status: "ACCEPTED"` and its reference.
3. The sandbox worker exposes PROCESSING after its persisted due time (five seconds plus polling/queue delay), then resolves the failure on a later pass.
4. `GET /transactions/{reference}` returns HTTP 200 with `status: "FAILED"`, `failureCode: "PAYMENT_NOT_APPROVED"` and a displayable `failureMessage`.
5. The normal signed `business_api.collection.failed` webhook carries that same terminal snapshot. Its delivery follows the normal retry and deduplication rules.

| Simulation code | Supported operations and methods | Deferred result |
| --- | --- | --- |
| `INVALID_DESTINATION` | Collection/payout; mobile money or crypto | FAILED; phone number or address rejected |
| `PAYMENT_NOT_APPROVED` | Mobile money collection | FAILED; customer did not approve on their phone |
| `PAYER_INSUFFICIENT_FUNDS` | Mobile money collection | FAILED; external payer lacks funds |
| `PROVIDER_UNAVAILABLE` | Collection/payout; mobile money or crypto | FAILED; simulated provider could not process payment |
| `PAYMENT_EXPIRED` | Collection/payout; mobile money or crypto | FAILED; expired before completion |
| `PAYMENT_CANCELLED` | Collection/payout; mobile money or crypto | FAILED; cancelled before completion |

These cases never call a provider or send an actual phone prompt. Collections credit nothing when they fail. Payouts must have sufficient virtual funds at acceptance, debit gross including fees, and refund once when the snapshotted sandbox policy permits. Inspect `refunded`; failure alone does not guarantee a refund. `INSUFFICIENT_FUNDS` is an immediate merchant-wallet error; `PAYER_INSUFFICIENT_FUNDS` is a distinct deferred customer-payment failure.

Use the same idempotency key and same processing code to retry an accepted intent. Changing its code or normalized payload returns HTTP 409 `IDEMPOTENCY_CONFLICT`; use a fresh key for a different test. An invalid method/type combination returns HTTP 400 `INVALID_TEST_ERROR_CODE` before acceptance.

## Header rules

- `X-Simulate-Error-Code` is the single simulation header. Values are case-insensitive; surrounding spaces are trimmed.
- Omit it for the normal sandbox success flow: HTTP 202 ACCEPTED, then PROCESSING and COMPLETED. SUCCESS and PENDING are not error codes and are not accepted header values.
- Blank, unknown or unsupported codes return HTTP 400 `INVALID_TEST_ERROR_CODE` with SANDBOX credentials.
- Real authentication, ownership and access restrictions take precedence; simulation cannot bypass them.
- LIVE keys ignore every value, including invalid/blank values, regardless of the server's Spring profile. The header changes neither execution nor LIVE idempotency fingerprints.
- The former scenario header has been removed. Historical persisted scenarios keep their original processing behavior.

See [testing](testing.md) for virtual funding, conversions and troubleshooting, and [webhooks](webhooks.md) for signature validation and delivery handling.
