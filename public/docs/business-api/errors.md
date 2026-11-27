# Error codes and sandbox simulation

Use `statusCode` (and `status`) for the HTTP status, and a meaningful business code to decide what to do. Do not branch on `message` text.

| Stage | Where the code appears | Meaning |
| --- | --- | --- |
| Request rejected | HTTP error body `errorCode` | The request was not accepted. Examples: `INSUFFICIENT_FUNDS`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_METHOD_UNAVAILABLE`. |
| Accepted payment fails during processing | Payment `failureCode` in GET responses and terminal webhook `data` | The payment was accepted but later failed. Examples: `PAYMENT_NOT_APPROVED`, `INVALID_DESTINATION`, `PROVIDER_UNAVAILABLE`. |

HTTP 202 is acceptance, not completion. The public payment status is `ACCEPTED`, `PROCESSING`, `COMPLETED` or `FAILED`. Polling a failed payment still returns HTTP 200: inspect `status` and `failureCode`.

## Mobile Money country availability

Mobile Money API collections, payouts and their quotes are enabled for DR Congo (`CD`) by default, in LIVE and SANDBOX. Congo-Brazzaville (`CG`) is a separate country and is not enabled by this default. Fondeka admins can change the global list or replace it for an account. The country comes from the selected payment method, independently of the caller's location, account residence or settlement currency. Crypto and wallet-funded bill payments retain their existing availability rules.

An unavailable country returns **HTTP 403 `MOBILE_MONEY_COUNTRY_NOT_ENABLED`**, before accepting a new payment, debiting/reserving funds, creating a provider request or queuing its webhook:

```json
{
  "message": "Mobile Money API payments are not enabled for this payment method's country. Available countries for your account: DR Congo (CD). Contact Fondeka support to request access to other countries.",
  "status": 403,
  "statusCode": 403,
  "errorCode": "MOBILE_MONEY_COUNTRY_NOT_ENABLED",
  "requestId": "22222222-2222-4222-8222-222222222222",
  "details": {
    "requestedCountryCode": "KE",
    "availableCountryCodes": ["CD"],
    "availableCountries": [{"code": "CD", "name": "DR Congo"}],
    "contactSupport": true
  }
}
```

Use the effective available countries in the response and contact Fondeka support to request others. An empty list means no Mobile Money API countries are currently enabled for that account. A payment method with missing country configuration is also rejected; `requestedCountryCode` may then be absent. Do not repeatedly retry without a configuration change. A rejected intent has not reserved its idempotency key; keep the original intent when retrying after enablement.

Previously accepted transactions continue processing and delivering signed webhooks. Status reads and identical idempotent replays remain available after country removal. No new request fields, keys, API version or webhook changes are needed. The portal's account-specific API catalogue filters out unavailable countries; the public guide catalogue uses the global list.

## Request rate limits

Every `/business-api/**` endpoint has shared request limits in LIVE and SANDBOX. The API first applies a client-IP budget before authentication, then checks the authenticated Business, API key and endpoint-family budgets together. All keys belonging to a Business share its Business and endpoint-family budgets, including across LIVE/SANDBOX. Switching keys, payment methods, product codes, quote endpoints or environment does not reset those shared budgets. Limits are shared across web processes.

Default sustained refill rates and immediate burst capacities:

| Budget | Requests/minute | Burst |
| --- | ---: | ---: |
| Client IP, before authentication | 600 | 60 |
| Business, all endpoints | 300 | 30 |
| API key, all endpoints | 180 | 20 |
| Quotes, shared by all `POST .../quote` endpoints | 60 | 5 |
| Bill account lookups, `POST .../account-lookup` | 30 | 3 |
| Other writes, including payment submissions and replays | 30 | 5 |
| Reads, including payment status and catalogs | 180 | 30 |

These are continuously replenished budgets, not fixed minute windows. A request must fit every applicable budget. Operators can tune the configured rates. A rejected quote does not consume authenticated Business/key/read capacity; status reads have their own endpoint-family budget.

An admission rejection returns HTTP 429 `RATE_LIMITED`, `Retry-After` in seconds, `Cache-Control: no-store`, and a server-generated `X-Request-Id` matching the JSON `requestId`. Example response headers:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 1
Cache-Control: no-store
X-Request-Id: 22222222-2222-4222-8222-222222222222
```

Response body:

```json
{
  "message": "Too many API requests. Wait before retrying; use the same idempotency key for a payment retry.",
  "status": 429,
  "statusCode": 429,
  "errorCode": "RATE_LIMITED",
  "requestId": "22222222-2222-4222-8222-222222222222",
  "details": { "retryAfterSeconds": 1, "scope": "quotes", "limitPerMinute": 60, "burst": 5 }
}
```

Wait at least `Retry-After`, use backoff with jitter and reduce concurrency. Cache catalog reads and debounce price lookups. A rate-rejected attempt does not enter payment processing, reserve an idempotency intent, debit funds, submit to a provider or enqueue a payment webhook. Retrying an earlier accepted intent must retain its original `Idempotency-Key`; a 429 does not cancel or refund that existing payment. Poll its existing reference or wait for its signed webhook.

If shared admission storage is unavailable, new API attempts return HTTP 503 `SERVICE_UNAVAILABLE` with `Retry-After: 1` before financial processing. Existing background payment processing and provider callbacks continue independently. The existing operation-specific sandbox daily quotas remain in effect and may return 429 without this admission detail/header contract. Simulating `RATE_LIMITED` tests client error handling; it does not consume or bypass real rate budgets.

### Retry-After client handling

`Retry-After` is an **optional response header**, documented starting with contract release **1.7.0**. The previously published 1.6.0 contract documented `429 RATE_LIMITED` without this header. Clients do not send it in their requests, and its value is calculated for each rate-limited attempt rather than fixed for an endpoint.

Fondeka sends a positive integer number of **seconds to wait after receiving the response**. For example, `Retry-After: 2` means wait at least two seconds before the next attempt; it is not an absolute timestamp or a millisecond value.

For HTTP 429 and retryable HTTP 503 responses:

1. Read a valid positive integer from `Retry-After`.
2. If the header is absent or invalid, use a valid positive `details.retryAfterSeconds` when available. Otherwise keep the existing exponential-backoff policy. Older responses and operation-specific quotas can omit both fields.
3. Wait at least that duration. Add jitter and retain any longer delay required by the client's backoff policy; avoid immediate retry loops.
4. Retry a payment with the **same `Idempotency-Key` and unchanged payload**. Do not generate a replacement intent because of a rate limit. Quotes and reads retain their existing header requirements.
5. Bound retries. If attempts remain unsuccessful, retain the request ID and any existing payment reference for investigation.

Clients already handling 429 with backoff remain compatible. Reading the new header improves retry timing; it does not change payment request fields, authentication, successful response formats or the outcome of an earlier accepted payment.

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
| `endpoints[].processingErrors` | Deferred sandbox payment fixtures with `errorCode`, `description`, `resultingStatus`, `paymentMethodTypes`, `simulatable` and `simulationValue`. Terminal failures use this code as `failureCode`; a PROCESSING fixture has no terminal webhook or failure fields. |

Only select entries with `simulatable: true`. Submit their `simulationValue` unchanged in the advertised header. An endpoint has no processing errors unless it starts a collection or payout. The catalog describes supported sandbox processing fixtures; LIVE provider failure coverage is not exhaustive and failure details may be absent.

The authenticated web portal catalog returns the same metadata. The [OpenAPI reference](openapi.v1.json) includes `x-error-codes`, `x-processing-errors`, `x-simulatable-error-codes`, response examples and the optional header on each merchant endpoint.

## Immediate rejection

`400 PAYMENT_METHOD_UNAVAILABLE` also covers a winning route that lacks its required local provider mapping. `400 FX_ROUTE_UNAVAILABLE` means an active currency or usable conversion rate is missing for that route. Both reject before payment acceptance and payout reservation; choose another method/currency or ask support to check configuration. SANDBOX can simulate either code from the error catalog without invoking a provider.


`403 BUSINESS_API_LIVE_PAYMENTS_DISABLED` means Fondeka has not enabled new LIVE API payments, or has paused their acceptance. Use SANDBOX for testing and wait for live availability before submitting a new live intent. No payment was accepted and the key is not consumed by this rejection. Previously accepted payments remain readable/replayable and continue to settle and deliver webhooks. Sandbox can simulate this code through `X-Simulate-Error-Code` on collections and payouts.

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
X-API-Key: fdk_sandbox_<secret>
Idempotency-Key: order-unapproved-001
X-Simulate-Error-Code: PAYMENT_NOT_APPROVED
Content-Type: application/json

{
  "amount": 10.00,
  "currency": "USD",
  "paymentMethodName": "MPESA_DRC",
  "accountRef": "+243970000000",
  "orderReference": "order-unapproved-001"
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
| `CRYPTO_INVOICE_EXPIRED` | Crypto collection | FAILED; unpaid invoice expired |
| `CRYPTO_ADDRESS_INVALID` | Crypto payout | FAILED; address rejected before transfer |
| `CRYPTO_NETWORK_UNAVAILABLE` | Crypto collection/payout | FAILED; network unavailable before submission/transfer |
| `CRYPTO_TRANSFER_REJECTED` | Crypto payout | FAILED; transfer rejected before broadcast |
| `CRYPTO_CONFIRMATIONS_PENDING` | Crypto collection/payout | PROCESSING; no terminal webhook, credit or automatic refund |

These cases never call a provider or send an actual phone prompt. Collections credit nothing when they fail. Payouts must have sufficient virtual funds at acceptance, debit gross including fees, and refund once when the snapshotted sandbox policy permits. Verify linked sandbox wallet entries; failure alone does not guarantee a refund, and the compact payment response has no refund flag. `INSUFFICIENT_FUNDS` is an immediate merchant-wallet error; `PAYER_INSUFFICIENT_FUNDS` is a distinct deferred customer-payment failure.

Use the same idempotency key and same processing code to retry an accepted intent. Changing its code or normalized payload returns HTTP 409 `IDEMPOTENCY_CONFLICT`; use a fresh key for a different test. An invalid method/type combination returns HTTP 400 `INVALID_TEST_ERROR_CODE` before acceptance.

For crypto examples, pending-confirmation behavior and portal selector integration, see [crypto sandbox simulations](crypto-sandbox-simulations.md). A pending-confirmation payout retains its gross debit; an unresolved chain outcome must not be treated as a definite failure or automatic refund.

## Header rules

- `X-Simulate-Error-Code` is the single simulation header. Values are case-insensitive; surrounding spaces are trimmed.
- Omit it for the normal sandbox success flow: HTTP 202 ACCEPTED, then PROCESSING and COMPLETED. SUCCESS and PENDING are not error codes and are not accepted header values.
- Blank, unknown or unsupported codes return HTTP 400 `INVALID_TEST_ERROR_CODE` with SANDBOX credentials.
- Real authentication, ownership and access restrictions take precedence; simulation cannot bypass them.
- LIVE keys ignore every value, including invalid/blank values, regardless of the server's Spring profile. The header changes neither execution nor LIVE idempotency fingerprints.
- The former scenario header has been removed. Historical persisted scenarios keep their original processing behavior.

See [testing](testing.md) for virtual funding, conversions and troubleshooting, and [webhooks](webhooks.md) for signature validation and delivery handling.
