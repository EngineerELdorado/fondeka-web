# Contract changelog

## 1.3.0 — 2026-10-26 — Crypto sandbox processing outcomes

`X-Simulate-Error-Code` gains crypto-specific invoice expiry, invalid destination address, pre-transfer network failure, rejected transfer and pending-confirmation fixtures on the existing collection/payout endpoints. Merchant/portal error catalogs advertise compatible payment method types and operation-specific codes. Read `resultingStatus`: `CRYPTO_CONFIRMATIONS_PENDING` follows ACCEPTED → PROCESSING, retains any payout debit and emits no terminal webhook. Definite failures follow existing polling/webhook/refund policy, with no provider or blockchain calls. Generic simulations, normal payload/access validation, idempotency, LIVE header ignoring and historical sandbox scenarios remain unchanged. Apply `20261126_business_api_crypto_simulations.sql` and deploy matching web/worker builds before using new values. See [the crypto simulation guide](crypto-sandbox-simulations.md).

## 2026-10-26 — Shorter API key prefixes

New credentials use `fdk_live_` and `fdk_sandbox_`. All previously issued LIVE (`fdk_biz_live_`, `fdk_biz_`) and SANDBOX (`fdk_biz_sandbox_`, `fdk_biz_test_`) keys remain accepted against their stored hash and environment. Existing integrations do not need to rotate keys. Newly stored display prefixes expose only four secret characters, and admin masking supports every issued format. Webhook signing secrets keep `whsec_`. Published sandbox examples and Postman accept the new and older sandbox formats while continuing to reject LIVE keys.

## 1.2.0 — 2026-10-26 — Order reference

`orderReference` replaces `clientReference` in collection/payout request bodies, payment responses, new webhook data and nested portal transaction snapshots. It remains optional, limited to 128 characters and independent of `Idempotency-Key`. Portal order filtering also uses `orderReference`. Existing stored references and idempotency fingerprints are preserved; old/new request names can replay the same intent without another charge. Legacy request bodies and the old portal filter name remain accepted as compatibility aliases, while responses and published schemas use only the new name. Conflicting portal filter aliases return 400. Previously saved webhook payloads keep their original bytes. Update request serializers, response readers, order correlation and developer examples; routes and financial processing remain unchanged.

Payment objects serialize core fields in this order: `environment`, `service`, `action`, `orderReference`, `fondekaReference`, `amount`, `fee`, `grossAmount`, `currency`, `status`. Optional crypto instructions and failure details follow. This ordering applies to submissions, lookups, portal snapshots and newly created webhook data; consumers should continue reading properties by name.

## 2026-10-26 — Destination-dependent payout discovery

Catalog and wallet-fee inheritance reads now use explicit metadata routing. Providers requiring a previously used funding destination remain eligible for static discovery, without missing-destination warnings. Inherited wallet fees are resolved within the selected API provider. Actual payout submission still evaluates recipient eligibility and funding history; a catalog read does not authorize a payout. Destinations missing from an execution lookup still produce a warning and exclude restricted routes. No API payload or portal integration change is required.

## 1.1.0 — 2026-10-26 — Compact payment responses

Submission, lookup, new webhook `data` and portal `transaction` snapshots now expose `clientReference`, `fondekaReference`, `amount`, `grossAmount`, one consolidated `fee`, `currency`, `environment`, `service`, `action` and `status`. Crypto instructions and sanitized failure details are included only when available. Internal IDs, fee splits, duplicate settlement fields and the refund flag are omitted.

Clients must rename response reads `reference` → `fondekaReference` and `allFees` → `fee`. Polling URLs and the portal's existing `reference` filter parameter are unchanged. Completed collections use the same money fields for reconciled settlement, including crypto under/overpayments; pending payments show the accepted quote. Financial processing, accepted quotes and wallet postings are unchanged. Already persisted webhook payloads remain immutable on retries; coordinate receiver rollout if consuming older queued events. The documentation/OpenAPI version advances; routes remain `/v1`. Updated SDK walkthroughs, webhook receivers and Postman capture the compact contract.

## 2026-10-26 — Local QA corrections

LIVE payments now reject deterministic missing provider mappings and FX configuration before acceptance or a payout hold. `FX_ROUTE_UNAVAILABLE` is documented and simulatable in SANDBOX. Unknown crypto network IDs return the advertised `404 CRYPTO_NETWORK_NOT_FOUND`. New API crypto collections validate and save the exact cent-denominated USD invoice price and applicable limits; workers and UniPayment minimum checks reuse that accepted snapshot. Genuine partial payments remain subject to minimum checks.

Portal onboarding adds an explicit, idempotent `POST /customer-api/businesses/default` using customer authentication, while GET discovery remains read-only. Business identity alone grants no paid tool access. Per-tool access reads honor the existing optional WEB device bypass and account enforcement overrides. Development PawaPay/Maplerad callbacks now use the durable webhook outbox.

## 2026-10-25 — Credential labels and webhook configuration

New API keys use `fdk_biz_live_` and `fdk_biz_sandbox_` prefixes. Previously issued `fdk_biz_` and `fdk_biz_test_` keys remain valid without rotation; authentication still checks the full key hash and its stored environment. Webhook signing secrets keep `whsec_`. Portal/admin metadata preserves the environment label while keeping existing masking rules.

Key creation and webhook updates now validate HTTPS URL format without resolving DNS. Delivery retains public-address checks before sending and again at connection time, normal TLS verification, disabled redirects and existing retry limits. A URL can be saved before its receiver is deployed; that does not certify delivery readiness. No merchant endpoint schema, payment flow or API version changes.

## 1.0.1 — 2026-10-25

New LIVE API collections and payouts require the global launch switch to be enabled. When disabled, a new intent returns HTTP 403 `BUSINESS_API_LIVE_PAYMENTS_DISABLED` before payment creation; SANDBOX remains available. Existing accepted payments keep their status reads, idempotent replays, processing and webhooks. The error catalog and OpenAPI describe the new rejection, which can be simulated in sandbox. The runtime API remains `/v1`.

## Optional independent API access

The existing all-tools bundle remains the default. Admins can opt accounts into separate tool pricing. True bundle purchases/grants continue to cover API access in either mode; Online Stores or POS-only purchases do not. Existing top-level access/purchase contracts stay available.

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
