# Make your first payment

This walkthrough collects 10 USD in sandbox, verifies a terminal webhook, then sends a 5 USD payout. Sandbox does not call payment providers or move real money. Sample fees below assume the default sandbox fixtures; always read the returned amounts.

## 1. Prepare your Business

Sign in to the Fondeka Business portal. Obtain your Business ID and activate Business Tools access if required. You need an HTTPS webhook destination on public port 443 before issuing a key. It cannot be a private/localhost address, contain URL credentials/fragments, or rely on redirects.

Prepare your public HTTPS proxy or development tunnel and use its `/fondeka/webhooks` URL when creating a **SANDBOX** credential in the portal. Save the API key and webhook signing secret when shown; they cannot be retrieved later. Then start the receiver below with that signing secret before submitting payments. Do not put either secret into frontend code, shared Postman values or source control.

## 2. Start a webhook receiver

Choose [Node.js](examples/node/webhook.mjs) or [Python](examples/python/webhook.py). Set these environment variables locally using your secret manager or terminal:

```bash
export FONDEKA_BUSINESS_ID='YOUR_BUSINESS_ID'
export FONDEKA_WEBHOOK_SECRET='YOUR_SANDBOX_WEBHOOK_SECRET'
export FONDEKA_EXPECTED_ENV='SANDBOX'
node docs/business-api/examples/node/webhook.mjs
# Alternatively: python3 docs/business-api/examples/python/webhook.py
```

The receiver listens on loopback port 8787. Forward your public HTTPS destination to it. It verifies HMAC, timestamp, Business and environment, then durably stores the event before returning 200. It demonstrates an inbox; add an asynchronous processor with an idempotent order-fulfillment operation for your application. For production with multiple instances, use a shared transactional inbox/database.

## 3. Configure your server-side client

```bash
export FONDEKA_API_KEY='YOUR_SANDBOX_API_KEY'
export FONDEKA_INTENT='my-first-integration-001'
```

Choose a unique intent for a new logical walkthrough, and preserve it if the connection fails or you rerun it. Each request derives its own idempotency key from this value. Reusing a key with different request content returns 409. To run against a local dev backend, set `FONDEKA_BASE_URL=http://localhost:8080`; use keys issued by that backend.

## 4. Collect, wait, then pay out

Run one complete client:

```bash
node docs/business-api/examples/node/client.mjs
# Or: python3 docs/business-api/examples/python/client.py
# Or: php docs/business-api/examples/php/client.php
```

Node requires version 22+, Python requires 3.10+, and PHP requires 8.1+ with cURL. Each client confirms `SANDBOX` through the wallet endpoint before writing. It submits a collection, polls its reference, and submits the payout only after the collection completes. [The cURL example](examples/curl/quickstart.sh) submits the collection and shows the polling request; it requires cURL with `--fail-with-body` and Python 3.

The core collection request is:

```http
POST /business-api/v1/businesses/{businessId}/collections
X-API-Key: YOUR_SANDBOX_API_KEY
Idempotency-Key: my-first-integration-001:collection
X-Fondeka-Test-Scenario: SUCCESS
Content-Type: application/json

{"amount":10,"currency":"USD","paymentMethodName":"MPESA_KENYA","accountRef":"+254707371664","clientReference":"my-first-integration-001","feeApplicationMode":"EXCLUSIVE"}
```

The first response is `202 Accepted`, usually with a non-terminal status and an opaque `reference`. Preserve the reference and poll `GET /business-api/v1/businesses/{businessId}/transactions/{reference}`. A polling timeout is not a failed payment. Continue later using the same reference, and preserve the original idempotency key if retrying submission.

## 5. Verify the result

With default sandbox fees, the completed collection credits 10 USD, with quoted gross 10.30 USD. The payout sends net 5 USD and debits gross 5.30 USD. Starting from zero, the final sandbox USD wallet is 4.70 USD. A replay creates no extra credit/debit; previous test activity will affect the starting balance.

The receiver should store `business_api.collection.completed` and `business_api.payout.completed`, with matching Business/environment and references. A terminal event can arrive before your polling request finishes. Persist your order/reference mapping before relying on fulfillment; handle retries and duplicates as described in [Webhooks](webhooks.md).

Next, follow the appropriate [integration guide](README.md), exercise [failure scenarios](testing.md), and complete the [go-live steps](go-live.md).
