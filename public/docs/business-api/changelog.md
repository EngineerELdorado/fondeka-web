# Contract changelog

## 2026-10-24 — API acceptance status

Business API responses and portal API transaction views now expose ACCEPTED, PROCESSING, COMPLETED and FAILED. New intents are ACCEPTED while queued, then PROCESSING once execution begins. Retried jobs never return to ACCEPTED, and idempotent POST replays return the current state. Terminal webhook types and wallet effects are unchanged.

The API-only request migration `20261117_business_api_accepted_status.sql` adds queue correlation and sandbox execution tracking; historical requests retain their previous projection. No client-app transaction enum, processor or workflow is changed. See [payment states](concepts.md).

## 2026-10-24 — Error discovery and simulation

Added merchant `/business-api/v1/businesses/{businessId}/error-codes` and owner portal `/customer-api/businesses/{businessId}/api-error-codes?environment=SANDBOX`. Each endpoint lists immediate request errors separately from supported deferred processing failures.

`X-Simulate-Error-Code` replaces the former scenario header. SANDBOX keys can select an immediate HTTP rejection or accept a payment that later fails through the worker, polling and signed webhook flow. Omit the header for success. LIVE keys ignore it. Specific business codes now distinguish idempotency conflicts, missing/unavailable methods, missing networks/destinations, resource ownership and sandbox-only routes.

The forward migration `20261116_business_api_processing_errors.sql` expands the sandbox constraint while preserving old scenarios. Deploy compatible web/worker binaries before using the new codes. Accepted payment errors retain the existing `failureCode` contract; request rejection uses `errorCode`. See [the reference](errors.md).

## 2026-10-24 — Portal payment catalog

The authenticated customer portal can fetch `/customer-api/businesses/{businessId}/api-catalog` for configured mobile-money/crypto payment-method names, crypto-network names, configuration flags and active method/network associations. The response uses stable payload names, shares identifiers between LIVE and SANDBOX, and requires existing Business ownership and Business Tools access. This is a configuration reference, not a guarantee of account-specific payment availability.

## 2026-10-24 — Three payment statuses (superseded by API acceptance status)

At this earlier stage, payment responses and portal snapshots exposed PROCESSING, COMPLETED and FAILED. Newly accepted payments and unresolved provider/reconciliation outcomes were PROCESSING. Cancellations and expiry expose FAILED, with a reason code where available. Portal status filters group the corresponding internal states.

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
