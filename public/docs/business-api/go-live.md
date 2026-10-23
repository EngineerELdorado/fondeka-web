# Go live

Complete the [sandbox quickstart](quickstart.md), test successful and failed payments, retries, concurrent requests and webhook duplicates. Check that order fulfillment is idempotent and based on verified completion and expected settlement, rather than the HTTP submission response.

## Prepare your account and receiver

Confirm Business Tools access where enforced, account/KYC payout eligibility, supported LIVE payment-method/network/currency combinations, limits and current fees. Fund the account's real fiat wallet before payouts. Business status/KYB metadata alone does not guarantee route availability.

Deploy an HTTPS webhook receiver on public port 443. Persist accepted events before 2xx, validate raw-byte HMAC and freshness, check Business/environment, and process the inbox asynchronously. Configure monitoring for unresolved payments, failed deliveries and reconciliation differences. Poll accepted references if an event is delayed or exhausted its delivery attempts.

## Issue separate LIVE credentials

Create a LIVE key in the Business portal with your production webhook URL. Save its API key and separate signing secret securely. Set your receiver's expected environment to LIVE. Retain sandbox credentials separately and remove the test-scenario header from LIVE submissions.

The example walkthrough clients and Postman collection deliberately refuse LIVE keys. Put your reviewed server-side integration into production explicitly. The API base URL and `/business-api/v1` routes stay the same; the key determines the environment. Rotating a key or changing webhook URL requires issuing a replacement credential. Continue accepting signed events using the original secret/destination for payments accepted before rotation.

## Verify your first live payments

Start with an appropriate small amount for the route's minimums. Compare quoted gross/net, stored payment status, verified webhook data and wallet movement. Check a real completed collection before depending on its proceeds, and confirm a payout does not debit again on completion.

Retain idempotency keys and references durably. A timeout or UNKNOWN/manual-review outcome must not trigger an automatic replacement payout. Provide request IDs and references to support for unresolved cases. This contract does not promise production provider behavior from sandbox results or offer public webhook replay controls.
