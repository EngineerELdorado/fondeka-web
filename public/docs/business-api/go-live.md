# Go live

Complete the [sandbox quickstart](quickstart.md), test successful and failed payments, retries, concurrent requests and webhook duplicates. Check that order fulfillment is idempotent and based on verified completion and expected settlement, rather than the HTTP submission response.

## Prepare your account and receiver

Confirm API access through the default Business Tools bundle or optional individual API purchase where enforced, account/KYC payout eligibility, supported LIVE payment-method/network/currency combinations, limits and current fees. Fund the account's real fiat wallet before payouts. Business status/KYB metadata alone does not guarantee route availability.

Deploy an HTTPS webhook receiver on public port 443. Persist accepted events before 2xx, validate raw-byte HMAC and freshness, check Business/environment, and process the inbox asynchronously. Configure monitoring for unresolved payments, failed deliveries and reconciliation differences. Poll accepted references if an event is delayed or exhausted its delivery attempts.

## Issue separate LIVE credentials

Fondeka must enable new LIVE API payments before your integration can submit them. A LIVE credential alone does not enable live acceptance. If a new collection or payout returns `403 BUSINESS_API_LIVE_PAYMENTS_DISABLED`, continue integration testing in SANDBOX and wait for live availability. Existing accepted payments remain readable, replayable and processed during a pause.

Create a LIVE key in the Business portal with your production webhook URL. New LIVE keys start with `fdk_live_`; SANDBOX keys start with `fdk_sandbox_`. Existing `fdk_biz_live_` / `fdk_biz_` LIVE and `fdk_biz_sandbox_` / `fdk_biz_test_` SANDBOX credentials remain valid. Save its API key and separate signing secret securely. You may issue a key before webhook DNS is ready, but saving the URL does not verify delivery: public DNS, TLS and connection-time address checks still apply to every delivery. Set your receiver's expected environment to LIVE. Retain sandbox credentials separately. LIVE credentials ignore `X-Simulate-Error-Code` if it is present; the API key determines the execution environment.

The example walkthrough clients and Postman collection deliberately refuse LIVE keys. Put your reviewed server-side integration into production explicitly. The API base URL and `/business-api/v1` routes stay the same; the key determines the environment. Rotate credentials by generating a replacement in the owner portal. You can edit an active key's webhook URL there without rotating its secrets. Continue accepting events for previously accepted payments using the originating credential's signing secret and last configured destination; in-flight attempts may still target a URL changed moments earlier.

## Verify your first live payments

Start with an appropriate small amount for the route's minimums. Compare quoted gross/net, stored payment status, verified webhook data and wallet movement. Check a real completed collection before depending on its proceeds, and confirm a payout does not debit again on completion.

Retain idempotency keys and references durably. A timeout or a payment remaining ACCEPTED or PROCESSING must not trigger an automatic replacement payout. Provide request IDs and references to support for unresolved cases. This contract does not promise production provider behavior from sandbox results or offer public webhook replay controls.
