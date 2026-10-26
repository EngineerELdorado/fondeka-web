# Receive and verify webhooks

Saving a webhook URL checks HTTPS syntax, port 443 and absence of URL credentials/fragments; it does not perform DNS resolution or probe the receiver. Delivery requires working public DNS and valid TLS, rejects non-public destinations, and rechecks DNS at connection time. DNS or destination failures use the normal retry/backoff and attempt limits. A successful configuration response does not mean the receiver is ready; have it operational before submitting payments.

Configure your HTTPS destination when generating credentials in the owner web portal. You can edit an active key's destination there without rotating the API key or signing secret. Future delivery attempts, including queued retries, use the updated URL; an attempt already in flight may still use the old URL. Event payloads and signing secrets remain unchanged. Revoked keys continue delivering accepted payments to their last configured destination using their original signing secret, so retain that receiver and secret until those payments finish. Editing a URL does not replay successful events or restart exhausted deliveries.

## Events and envelope

The API emits `business_api.collection.completed`, `business_api.collection.failed`, `business_api.payout.completed` and `business_api.payout.failed`. Event data has status COMPLETED or FAILED, matching the event type. Cancellation and expiration produce failed events. Payments still ACCEPTED or PROCESSING do not generate terminal events, including payments awaiting provider reconciliation. Sandbox funding/conversions do not generate payment events.

The envelope contains `id` (UUID), `type`, `createdAt`, `environment`, and `data`, the compact payment object used by submission and lookup. The [OpenAPI callback and event schemas](openapi.v1.json) define every field. Check both environments, `data.fondekaReference`, status, currency and amount before fulfilling an order. Resolve Business ownership through the trusted API-key/signing-secret configuration and your saved reference/order mapping; there is no body-level Business ID. Never select a signing secret from unverified payload values.

## Authenticate raw bytes

Headers are `X-Fondeka-Event-Id`, `X-Fondeka-Timestamp` (Unix seconds) and `X-Fondeka-Signature` (`v1=` followed by lowercase HMAC-SHA256 hex).

1. Read the exact raw request-body bytes before JSON parsing or body transformation.
2. Check the timestamp is within your freshness window; the examples use ±300 seconds.
3. Compute HMAC-SHA256 with the **webhook signing secret**, over the UTF-8 timestamp, a literal `.`, then the raw body bytes.
4. Compare signatures in constant time. Only then parse JSON and validate ownership/environment, event type and header/body event ID equality.
5. Insert the verified event into a durable inbox with a unique event ID. Return 2xx after commit, and process it asynchronously.

Use the [Node receiver](examples/node/webhook.mjs) or [Python receiver](examples/python/webhook.py). Both preserve raw bytes, reject tampering/stale events/wrong signing secrets/wrong environments, and persist before acknowledgment. Configure each receiver with the secret belonging to its Business API key. Your inbox processor must also match the reference/order reference to an order owned by that integration before fulfillment. They are executable examples; use a shared database inbox and idempotent fulfillment in a production application with multiple instances.

## Delivery and deduplication

Any 2xx acknowledges delivery. A non-2xx, redirect or transport failure schedules another attempt, up to ten attempts. Scheduled retry delays are 30, 60, 120, 240, 480, 960, 1800, 1800 and 1800 seconds; worker scheduling can make actual delivery later. Redirects are not followed.

The event ID, creation time and raw payload remain fixed. Each attempt has a fresh timestamp/signature, so verify freshness again before acknowledging a duplicate. Delivery can repeat after an acknowledgment is lost. Never depend on ordering across payments. Make your own business-side fulfillment idempotent by payment reference as well as storing unique event IDs.

A webhook is a financial snapshot taken after reconciliation. GET returns the current compact payment state; it does not expose a refund flag. Existing saved events retain their original bytes, including an older schema, across retries; only newly created events use the compact contract. If events stop arriving or all attempts fail, poll the Fondeka reference and investigate the receiver; this version has no public webhook replay/history endpoint.
