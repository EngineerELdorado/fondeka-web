# Payment quotes and price limits

Business API v1 adds destination-aware pricing without changing existing payment payloads or response fields. Catalog fee ranges remain estimates for the winning eligible route before a recipient is known. A payout recipient can change route eligibility and provider choice.

## Server integrations

Use the same Business-specific `X-API-Key` as payments:

```http
POST /business-api/v1/businesses/{businessId}/collections/quote
POST /business-api/v1/businesses/{businessId}/payouts/quote
Content-Type: application/json
```

Send the payment fields, including the actual payer/recipient and selected currency, method, network and fee mode. No `Idempotency-Key` is required. Example payout:

```json
{
  "amount": 10,
  "currency": "USD",
  "paymentMethodName": "MPESA_KENYA",
  "accountRef": "+254707371664",
  "feeApplicationMode": "EXCLUSIVE"
}
```

The response is HTTP `200`, `Cache-Control: no-store`. Illustrative amounts:

```json
{
  "environment": "LIVE",
  "service": "BUSINESS_API",
  "action": "BUSINESS_API_PAYOUT",
  "amount": 10,
  "fee": 0.30,
  "grossAmount": 10.30,
  "currency": "USD",
  "feeApplicationMode": "EXCLUSIVE",
  "calculatedAt": "2026-10-27T12:00:00Z",
  "binding": false
}
```

All money fields are in `currency`. `amount` is net, `fee` is consolidated and `grossAmount = amount + fee`. EXCLUSIVE requests net and adds fees; INCLUSIVE requests gross and deducts fees. The applied default mode is returned when the request omitted it.

Quotes use payment acceptance's actual route selection, including recipient/source-funding restrictions, fallback providers, account overrides, amount tiers, fee floors and currency conversion. They validate current method/network/policy availability. They create no payment reference, provider invoice, API intent, wallet or wallet entry, and reserve no funds. A funded wallet is not required merely to price a payout.

`calculatedAt` is a calculation timestamp. It is not an expiry or a promise to hold that price, FX rate or provider. `binding` is always false. Acceptance recalculates against current policy; use price limits to enforce the price you accept. Quotes remain available when the admin pauses new LIVE payments; that switch still blocks new LIVE payment acceptance.

## Protect acceptance against a price increase

After displaying the quote, send its price as optional caps on the existing collection/payout endpoint:

```json
{
  "amount": 10,
  "currency": "USD",
  "paymentMethodName": "MPESA_KENYA",
  "accountRef": "+254707371664",
  "feeApplicationMode": "EXCLUSIVE",
  "orderReference": "order-0001",
  "maxFee": 0.30,
  "maxGrossAmount": 10.30
}
```

Use the normal `Idempotency-Key`. Either or both caps may be supplied. Both are nonnegative fiat values with at most two decimal places, denominated in `currency`. A quoted value equal to the cap is permitted. If the actual acceptance quote exceeds either cap, HTTP `409 PAYMENT_PRICE_LIMIT_EXCEEDED` returns safe current `amount`, `fee`, `grossAmount`, `currency` and the supplied limits in `details`. No payment is accepted, no funds are debited and no provider work is queued. Refresh the quote and obtain the customer's/merchant's consent before increasing a cap. Do not silently raise limits.

INCLUSIVE callers should generally set `maxFee` too: a gross cap alone does not stop a higher fee reducing the recipient's net. Caps protect the acceptance quote; normal later confirmed crypto partial/overpayment reconciliation still uses actual received funds and the accepted settlement policy.

Retries of an accepted intent return that original payment's current state, even if prices or the LIVE launch switch changed. Supplied caps are part of the normalized idempotent intent; changing/removing them on an accepted key returns `409 IDEMPOTENCY_CONFLICT`. Omitting both preserves the previous uncapped contract and historical fingerprints. Existing clients therefore continue working, but should adopt quoting/caps before relying on catalog estimates as fixed prices.

## Web portal

The browser must use its normal customer JWT and existing device-session policy, without exposing secret API keys:

```http
POST /customer-api/businesses/{businessId}/api-transactions/collections/quote?environment=LIVE
POST /customer-api/businesses/{businessId}/api-transactions/payouts/quote?environment=SANDBOX
```

Request and response shapes are the same. `environment` defaults to LIVE. The backend derives the owner from authentication and checks Business ownership and API-tool access; no client account ID is accepted. An issued API key is not needed to preview pricing. Keep actual secret-key integrations on the merchant's server.

Invalidate displayed quotes whenever amount, currency, method, recipient, network or fee mode changes. Display the returned fee and gross, not a frontend FX calculation. Handle a price-cap conflict by showing the refreshed quote for review.

## Sandbox and errors

SANDBOX quotes use the same deterministic isolated fee fixtures as SANDBOX payment acceptance. They do not call LIVE routes/providers, consume the accepted-payment quota, create a virtual wallet or require a virtual balance. Quotes do not start a processing scenario or emit webhooks.

Merchant quote endpoints advertise endpoint-specific request errors through `GET /business-api/v1/businesses/{businessId}/error-codes`. With a SANDBOX key, `X-Simulate-Error-Code` may simulate advertised immediate request errors, including `PAYMENT_PRICE_LIMIT_EXCEEDED`. Processing outcomes such as `PAYMENT_EXPIRED` do not apply to a quote and return `400 INVALID_TEST_ERROR_CODE`. LIVE keys ignore this header. Customer-JWT portal previews do not use the merchant simulation header.

Authentication, ownership, Business Tools access and account restrictions are checked normally. Malformed/unsupported values return the existing error envelope. A quote does not guarantee funds, future availability or eventual payment completion; only the normal confirmed transaction/webhook does that.
