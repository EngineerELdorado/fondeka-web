# Collect mobile money

Before starting, complete the [sandbox quickstart](../quickstart.md). Use the payment-method enum for the intended operator/country/currency, not its translated label or provider name.

## Submit the collection

```http
POST /business-api/v1/businesses/{businessId}/collections
X-API-Key: YOUR_API_KEY
Idempotency-Key: invoice-1001:collection
Content-Type: application/json

{"amount":500,"currency":"KES","paymentMethodName":"MPESA_KENYA","accountRef":"+254707371664","clientReference":"invoice-1001","feeApplicationMode":"EXCLUSIVE"}
```

Use the payer's international phone number, without a national trunk zero after the country code. Amount is fiat net for EXCLUSIVE; fees are added to the gross collected. Use INCLUSIVE when the request amount is the total the payer should pay. Supported LIVE currencies, limits and routes depend on configuration.

For sandbox, use a SANDBOX key and omit the simulation header for normal success. See [error simulation](../errors.md) to test immediate or deferred failures.

## Wait for confirmation

Save `fondekaReference` from the 202 response and map it to your invoice. Use it in the unchanged `/transactions/{reference}` lookup URL. The customer may need to approve a prompt on the phone they are paying with. Poll the transaction and verify its signed terminal webhook. Credit/fulfill your order only after confirmed completion and checking the configured Business, currency and completed `amount`. Failed/canceled collections do not credit the wallet.

If submission times out, retry with the original key and unchanged body. If the result remains ACCEPTED or PROCESSING, keep the invoice unresolved and investigate long-running payments before collecting again. Optional `failureCode`/`failureMessage` may provide a customer-facing explanation, but not every failure has one.

See [financial states and amounts](../concepts.md), [webhook verification](../webhooks.md), and the complete [request/response reference](../openapi.v1.json).
