# Simulate crypto collection and payout outcomes

`X-Simulate-Error-Code` works with crypto on the same merchant payment endpoints used for Mobile Money:

```http
POST /business-api/v1/businesses/{businessId}/collections
POST /business-api/v1/businesses/{businessId}/payouts
```

Use a **SANDBOX** API key, a configured crypto `paymentMethodName` and `networkName`, and the normal fiat amount/currency payload. Crypto payouts also require `accountRef` and enough virtual wallet funds to cover the gross debit. No provider or blockchain is called. Returned sandbox payment instructions are unpayable fixtures; never send real crypto to them.

## Available crypto processing simulations

| Header value | Collection | Payout | Result after acceptance |
| --- | --- | --- | --- |
| `CRYPTO_INVOICE_EXPIRED` | Yes | No | FAILED: the unpaid invoice expired. No wallet credit. |
| `CRYPTO_ADDRESS_INVALID` | No | Yes | FAILED: the destination was rejected before a transfer was sent. |
| `CRYPTO_NETWORK_UNAVAILABLE` | Yes | Yes | FAILED: the network was unavailable before payment submission/transfer. |
| `CRYPTO_TRANSFER_REJECTED` | No | Yes | FAILED: the transfer was definitively rejected before broadcast. |
| `CRYPTO_CONFIRMATIONS_PENDING` | Yes | Yes | PROCESSING: awaiting confirmations; no terminal webhook or automatic refund. |

Existing generic processing codes remain available for crypto: `INVALID_DESTINATION`, `PROVIDER_UNAVAILABLE`, `PAYMENT_EXPIRED` and `PAYMENT_CANCELLED`. Immediate request-error simulations also work, including crypto network errors, unavailable FX routes and `INSUFFICIENT_FUNDS` for a payout. Immediate errors reject before creating a payment or reserving money.

`PAYMENT_NOT_APPROVED` and `PAYER_INSUFFICIENT_FUNDS` describe Mobile Money collections and remain invalid for crypto. Selecting a crypto-only code for Mobile Money, an invoice-only code for payouts, or a payout-only code for collections returns `400 INVALID_TEST_ERROR_CODE` without accepting a payment.

Discover the authoritative list through either:

- Merchant: `GET /business-api/v1/businesses/{businessId}/error-codes` with the SANDBOX key.
- Authenticated owner portal: `GET /customer-api/businesses/{businessId}/api-error-codes?environment=SANDBOX` with the existing customer JWT/device policy.

For the selected operation, filter `processingErrors` by `paymentMethodTypes` containing `CRYPTO` and `simulatable: true`. Submit its `simulationValue`. Read **`resultingStatus`**, rather than assuming every selectable condition produces FAILED. The existing response schema and endpoint paths are unchanged.

## Example: expired crypto collection

```http
POST /business-api/v1/businesses/42/collections
X-API-Key: fdk_sandbox_YOUR_SECRET
Idempotency-Key: crypto-expiry-001
X-Simulate-Error-Code: CRYPTO_INVOICE_EXPIRED
Content-Type: application/json

{
  "orderReference": "crypto-order-001",
  "amount": 10,
  "currency": "USD",
  "paymentMethodName": "USDT",
  "networkName": "TRC20"
}
```

The backend returns HTTP 202 with `status: "ACCEPTED"` and `fondekaReference`. Poll the returned reference. After the normal sandbox delay, processing changes to PROCESSING and then FAILED. For this expiry fixture, `cryptoDetails.expiresAt` uses the scheduled sandbox deadline so the invoice countdown and simulated expiry agree. The final backend status remains authoritative. An excerpt of the final payment is:

```json
{
  "status": "FAILED",
  "failureCode": "CRYPTO_INVOICE_EXPIRED"
}
```

This excerpt omits the unchanged payment fields and displayable `failureMessage`. The normal signed `business_api.collection.failed` webhook carries the same terminal snapshot and follows existing retry/deduplication rules. A failed collection credits nothing.

For a rejected payout, use `/payouts`, supply the required destination and select `CRYPTO_TRANSFER_REJECTED`. Acceptance debits the virtual gross amount once. Failure refunds that gross debit once **when the refund policy snapshotted at acceptance permits it**. Inspect sandbox wallet entries for `PAYOUT_DEBIT` and any linked `PAYOUT_REFUND`; the compact payment response has no refund flag.

## Pending confirmations

Select `CRYPTO_CONFIRMATIONS_PENDING` to test a payment that does not reach a final result:

1. POST returns ACCEPTED.
2. A sandbox worker pass exposes PROCESSING.
3. The payment remains PROCESSING. It is removed from scheduled completion work rather than repeatedly settled.
4. A collection receives no credit. A payout keeps its original virtual gross debit reserved; there is no automatic refund.
5. No completed/failed webhook or `failureCode` is produced because the outcome remains unresolved.

This is a deliberately persistent test condition, not a real chain lookup. Poll with backoff and display a pending state. Changing the simulation code on the same accepted idempotency key returns `409 IDEMPOTENCY_CONFLICT`; the API does not provide a resolve-pending simulation endpoint. Use a fresh intent to test a separate terminal outcome. Virtual top-ups remain available under their normal limits.

## Compatibility and financial limits

- Omit the header for normal sandbox success. LIVE credentials ignore it, including unknown or blank values, regardless of the server profile.
- Replays of an accepted payment must retain the same idempotency key, normalized payload and processing code. Retries do not create another debit, credit, refund or terminal webhook event.
- Authentication, Business ownership, entitlement, method/network, currency/amount and wallet validation still apply. The header does not bypass them.
- These fixtures model definite failures and waiting for confirmations. They do not simulate partial/overpaid settlement amounts. A real partial payment is not automatically a failure: LIVE eligibility and reconciled fiat settlement remain authoritative.
- Apply migration `20261126_business_api_crypto_simulations.sql` and deploy compatible web and worker builds before selecting the new codes. The migration expands only sandbox validation/scheduling constraints and preserves historical scenarios and accepted quote snapshots. Avoid selecting new scenarios during a mixed-version rollout.

See [error codes](errors.md), [sandbox wallets and testing](testing.md), [crypto collections](guides/crypto-collection.md) and [crypto payouts](guides/crypto-payout.md).
