# Business API activity: transaction context and receipt display

The web portal keeps one paginated transaction table for collections, payouts and bill payments. Rows identify the exact action instead of treating every non-payout as a collection. Desktop and mobile use the same presentation rules. The existing detail view shows relevant receipt information.

## Existing endpoints and scoping

- `GET /customer-api/businesses/{businessId}/api-transactions`
- `GET /customer-api/businesses/{businessId}/api-transactions/{reference}`

Keep authenticated Business ownership, explicit LIVE/SANDBOX isolation, no-store responses, stable request IDs, sorting, pagination, and exact reference/date/status/currency semantics. The action filter accepts `BUSINESS_API_COLLECTION`, `BUSINESS_API_PAYOUT`, and `BUSINESS_API_BILL_PAYMENT`. All filters combine on the server before pagination. Do not filter only the rows on the current page.

The merchant API resource, webhook schema, payment execution, wallet effects, pricing and reconciliation are unchanged. The existing `transaction` snapshot remains authoritative for reference, action, status and all monetary values.

## Optional portal fields

Add `details` to list and detail envelopes. Add `receipt` to the detail envelope only. These fields are optional for historical data; omit unavailable values rather than guessing from a reference prefix, provider route, product code or transaction status.

```json
{
  "requestId": 123,
  "apiKeyId": 4,
  "apiKeyName": "Checkout",
  "createdAt": "2026-11-23T10:00:00Z",
  "updatedAt": "2026-11-23T10:00:05Z",
  "transaction": {
    "environment": "LIVE",
    "service": "BUSINESS_API",
    "action": "BUSINESS_API_BILL_PAYMENT",
    "fondekaReference": "opaque-reference",
    "orderReference": "order-123",
    "status": "COMPLETED",
    "amount": 10,
    "fee": 0.3,
    "grossAmount": 10.3,
    "currency": "USD"
  },
  "details": {
    "billProductCode": "SOCODEE",
    "billProductName": "SOCODEE",
    "billCategory": "ELECTRICITY",
    "accountNumber": "001234",
    "operation": "PAY",
    "refunded": false
  },
  "receipt": {
    "receiptNumber": "receipt-123",
    "providerReference": "provider-confirmation-123",
    "tokens": ["NONPAYABLE-EXAMPLE"],
    "units": "15 kWh",
    "valueReceived": "Electricity purchase"
  }
}
```

For collections and payouts, `details` uses `paymentMethodName`, `paymentMethodDisplayName` and `accountRef`. Use the accepted transaction's method and account reference. Crypto denomination/network/instructions continue to come from `transaction.cryptoDetails`. A collection deposit address must not be displayed as the payer's identity.

For bills, return the captured `billProductCode`, `accountNumber` and `operation` (`PAY`, `TV_RENEW`, `TV_CHANGE`). Product display name/category can come from the existing linked bill product when available. Historical sandbox transactions may only retain a method or product code; do not invent an account reference or label. `refunded` is explicit evidence from the existing refund timestamp, independent of terminal status. FAILED alone never means refunded.

## Receipt projection

The frontend reads only these allowlisted fields:

| Field                                | Display                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `receiptNumber`                      | Customer receipt number                                                     |
| `providerReference`                  | Public provider confirmation reference                                      |
| `tokens`                             | Literal strings, preserving leading zeros; individually selectable/copyable |
| `units`                              | Number or scalar text including any unit supplied by the provider           |
| `valueReceived`                      | Scalar customer delivery value                                              |
| `newSubscription.subscriptionNumber` | Subscription identifier                                                     |
| `newSubscription.offerCode`          | Offer identifier                                                            |
| `newSubscription.name`               | Package name                                                                |
| `newSubscription.expiresAt`          | ISO date/time for subscription expiry                                       |
| `newSubscription.price`, `.currency` | Package price with explicit currency                                        |
| `newSubscription.note`               | Customer-facing receipt note                                                |

Reuse the existing `BusinessApiBillViews.receipt` TV mapping (`mainOffer` → `name`, `endOfSubscription` → `expiresAt`, display price/currency when present), then project only scalar public fields. Neither the frontend nor backend should render arbitrary nested payloads, HTML, provider requests/responses, authentication data, internal costs, FX margins, routing configuration or gift-card secrets. Unknown fields are ignored, not dumped as JSON. Malformed optional receipt values do not break the payment snapshot.

A receipt is evidence associated with the transaction, not an independent success signal. Keep the canonical payment status visible. A receipt can arrive later; an empty receipt is not a failure. Never fabricate a receipt for a queued/processing transaction. Sandbox completed bills use an explicitly nonpayable test token and synthetic description. No provider calls are made by these reads.

## Implementation and rollout

Frontend: `api-workspace.tsx`, `api-transaction-display.ts`, `portal-query.ts`, `types.ts`, EN/FR copy and demo fixtures. Unknown future actions display as Other transaction, never Collection. Missing enrichment renders without invented values. The receipt is fetched through the existing detail read and refreshed with it.

Matching backend source changes are implemented in `BusinessApiPortalPresentation`, `BusinessApiResourceMapper`, `BusinessApiPortalTransactionResource` and `BusinessPortalService`, with projection, ownership and filter tests. The six-argument portal resource constructor remains available for existing callers. No schema migration is required.

Deploy the backend projection and third action filter together with the frontend. The UI can classify old responses correctly, but bill filtering and the newly exposed account/receipt context require the matching backend deployment. Ensure real provider integrations normalize their customer receipt information into these allowlisted keys; arbitrary provider payloads are deliberately not exposed.

Validation covers mixed history, server filtering before pagination, both environments, legacy missing metadata, unexpected future actions, literal token preservation, zero values, malformed receipts, nested TV receipt sanitization and existing owner/environment checks.
