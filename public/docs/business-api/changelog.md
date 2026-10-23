# Contract changelog

## 2026-10-24 — Three payment statuses

Payment responses and portal snapshots expose only PROCESSING, COMPLETED and FAILED. Newly accepted payments and unresolved provider/reconciliation outcomes remain PROCESSING. Cancellations and expiry expose FAILED, with a reason code where available. Portal status filters group the corresponding internal states.

New terminal webhooks use `.completed` or `.failed`; cancellation/expiry generate failed events. Existing saved webhook payloads remain immutable across delivery retries. Internal financial statuses, reconciliation and refund rules retain their existing behavior.

## 2026-10-23 — Quote context and reporting corrections

- Crypto instructions include `exchangeRateCurrency`: USD for LIVE and the fiat payment currency for SANDBOX. TRX/TRON and ETH/ETHEREUM aliases return TRC20 and ERC20.
- LIVE EXCLUSIVE collection tariff selection uses the gross amount submitted to the provider. Existing accepted payments keep their quote.
- Business API reporting preserves the original requested amount, the applied fee mode and a precise acceptance-time USD rate. Provider crypto invoice prices retain cent rounding.
- Clarified the sandbox top-up quota: 100 new operations per account/currency wallet per UTC day.

## 1.0.0 — 2026-10-23

Initial published merchant documentation contract for `/business-api/v1`: mobile-money and crypto collections/payouts, payment lookup, account wallet balances, sandbox funding/history/conversion, and signed terminal callback schemas.

Merchant responses gain server-generated `X-Request-Id`; mapped merchant HTTP errors use a consistent body and include `requestId`. Customer/admin authentication and their exception handlers retain their existing contracts.

The generated reference documents 202 acceptance separately from terminal payment completion and includes request examples, fee/settlement semantics, sandbox scenarios, idempotency and webhook retry rules. The reference and sandbox Postman collection are versioned artifacts checked against actual MVC/webhook serialization in CI.
