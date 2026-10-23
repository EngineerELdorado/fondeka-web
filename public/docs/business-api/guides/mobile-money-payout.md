# Send mobile money

Complete the [quickstart](../quickstart.md), then ensure your account has enough fiat funds to cover the payout's **gross amount including fees**. LIVE payouts also follow existing account restrictions, KYC, configured limits and provider availability.

## Submit the payout

```http
POST /business-api/v1/businesses/{businessId}/payouts
X-API-Key: YOUR_API_KEY
Idempotency-Key: disbursement-1001:payout
Content-Type: application/json

{"amount":500,"currency":"KES","paymentMethodName":"MPESA_KENYA","accountRef":"+254707371664","clientReference":"disbursement-1001","feeApplicationMode":"EXCLUSIVE"}
```

`accountRef` is the recipient's international phone number. EXCLUSIVE sends the requested net and adds fees to the wallet debit. INCLUSIVE treats the requested amount as the gross wallet debit and reduces the amount sent by fees. Do not assume fees from a previous payment are still current.

Use a SANDBOX key for tests, with an optional test-scenario header. You can fund virtual balances through the sandbox top-up endpoint. A LIVE key cannot use sandbox funding.

## Track the debit and outcome

An accepted payout reserves/debits gross immediately; completion does not debit a second time. Save its reference, poll and process the signed terminal event. Do not mark your disbursement paid from the 202 response alone.

For FAILED, inspect `refunded`. Automatic refunds depend on policy; a failed payout with `refunded:false` can require manual refund. GET shows later updates. PROCESSING also covers an unresolved provider submission: retain the payment reference and contact support if it remains unresolved. Reuse the original idempotency key after transport errors; never create a replacement automatically.

See [wallet effects](../concepts.md), [webhooks](../webhooks.md), and the [API reference](../openapi.v1.json).
