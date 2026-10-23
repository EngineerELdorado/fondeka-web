# Contract changelog

## 1.0.0 — 2026-10-23

Initial published merchant documentation contract for `/business-api/v1`: mobile-money and crypto collections/payouts, payment lookup, account wallet balances, sandbox funding/history/conversion, and signed terminal callback schemas.

Merchant responses gain server-generated `X-Request-Id`; mapped merchant HTTP errors use a consistent body and include `requestId`. Customer/admin authentication and their exception handlers retain their existing contracts.

The generated reference documents 202 acceptance separately from terminal payment completion and includes request examples, fee/settlement semantics, sandbox scenarios, idempotency and webhook retry rules. The reference and sandbox Postman collection are versioned artifacts checked against actual MVC/webhook serialization in CI.
