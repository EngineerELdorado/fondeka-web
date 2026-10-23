# Amounts, wallets and payment states

## Financial ownership

An API key belongs to one Business. The Business's owning account owns the LIVE fiat wallets. Multiple Businesses under that account share those balances; their credentials, payments and idempotency scopes remain separate. Sandbox wallets are isolated virtual account wallets, also shared by that account's Businesses. Sandbox activity never appears as a real financial transaction in normal customer transaction history.

## Fiat and crypto amounts

Request `amount` and `currency` always describe fiat, even for a crypto method. `10 USD` with `USDT/TRC20` is a USD-priced payment. Use the returned `cryptoDetails.amountInCrypto`, network and address for the actual crypto transfer. A BTC quantity is not the same as the transaction's fiat amount. Monetary requests permit at most two decimal places; compute money with decimal arithmetic rather than binary floating point.

| Field | Meaning |
| --- | --- |
| `amount` | Quoted net fiat amount |
| `internalFeeAmount` | Fondeka fee component |
| `externalFeeAmount` | External fee component |
| `allFees` | Sum of fee components |
| `grossAmount` | Quoted net plus all fees; payout wallet debit |
| `settlementAmount` | Reconciled gross settlement |
| `settlementNet` | Reconciled net credited by a completed collection |
| `refunded` | Whether a payout debit has actually been refunded |

EXCLUSIVE requests net and adds fees. INCLUSIVE requests gross and deducts fees. For example, with total fees of 0.30, EXCLUSIVE amount 10 produces net 10/gross 10.30; INCLUSIVE amount 10 produces gross 10/net 9.70. Actual LIVE percentages, flat fees, minimums and rounding depend on the route. An omitted/null mode uses the applicable route default; sandbox defaults to EXCLUSIVE.

Crypto under/overpayments can produce settlement values different from the original quote. Use confirmed `settlementNet` for reconciliation and your own order-fulfillment rules for amount mismatches.

## Lifecycle and wallet effects

| State | Your integration should do |
| --- | --- |
| `NONE`, `INITIATED`, `SUBMITTED`, `PROCESSING`, `FUNDED`, `EXECUTING` | Treat as in progress; poll with backoff and await the terminal event |
| `COMPLETED` | Reconcile success; completed collections credit net once, completed payouts do not debit again |
| `FAILED`, `CANCELED` | Reconcile failure/cancellation; inspect `refunded` for payouts |
| `UNKNOWN`, `MANUAL_INTERVENTION_REQUIRED` | Keep the operation unresolved, retain its reference, and investigate; do not create a replacement payout automatically |

An accepted payout debits/reserves gross immediately. A completed collection credits only after payment confirmation. Failed/canceled payouts can require manual refunds when automatic refund policy is disabled; the status alone does not promise a refund. Webhooks are immutable snapshots; GET shows later refund updates. Unknown outcomes retain reserved payout funds until reconciliation.

## Request identity and retries

Use `Idempotency-Key` on collections, payouts, sandbox top-ups and sandbox conversions. Allowed values are 1–128 ASCII letters, digits, `.`, `:`, `_` or `-`. Payment keys are scoped to Business+environment across keys and collection/payout directions. Sandbox funding and conversion keys have account-level scopes for their respective operations. Converting between a name and its matching legacy ID does not create a new payment.

After a timeout or retryable HTTP failure, retry the same logical operation with the same key and payload. A 409 means that key already belongs to different normalized content; recover the original operation before deciding to create a new intent. `clientReference` is your correlation field, not a substitute for idempotency.

Each merchant HTTP attempt returns a fresh `X-Request-Id`, also present as `requestId` in errors. Preserve it when asking support for help. Webhook event IDs are separate identifiers and stay stable across delivery retries.
