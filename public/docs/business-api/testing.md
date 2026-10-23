# Test and troubleshoot

Use a SANDBOX credential on the same merchant routes. Sandbox enforces Business ownership and access policy while using isolated virtual wallets and synthetic pricing. It does not prove that a LIVE route, currency or network is enabled, that a real address is valid, or that the real provider supports a particular amount.

## Simulate outcomes

Add `X-Fondeka-Test-Scenario` to collection/payout submission. Omission means SUCCESS. The header is rejected with LIVE credentials, even when empty. Use a new idempotency key when changing a scenario; replaying an existing intent preserves it.

| Scenario | Result |
| --- | --- |
| `SUCCESS` | COMPLETED; collection credits net, payout retains its initial gross debit |
| `INVALID_DESTINATION` | FAILED |
| `INSUFFICIENT_FUNDS` | FAILED; simulated external failure, separate from the sandbox wallet's own balance check |
| `PAYMENT_NOT_APPROVED` | FAILED |
| `CANCELED` | CANCELED |
| `EXPIRED` | CANCELED with expiration explanation |
| `PENDING` | Remains PROCESSING; accepted payout funds stay reserved |

Failed/canceled payouts refund their gross debit when the snapshotted sandbox refund policy permits it. Always inspect `refunded`; account for policy changes and historical simulations separately. Existing status-only sandbox payments created before virtual wallets were introduced do not gain retroactive wallet effects.

## Fund and convert virtual wallets

Use `POST /business-api/v1/businesses/{businessId}/sandbox-wallets/top-ups` with `Idempotency-Key` and `{"amount":100,"currency":"USD"}`. Maximum 1,000,000 per top-up and 100 new top-ups per account per UTC day. Replaying a successful identical top-up does not consume another quota slot. Inspect balances with `/wallets` and entries with `/sandbox-wallets/USD/entries?page=0&size=20`.

History returns `{"content":[...],"page":{"size":20,"number":0,"totalElements":1,"totalPages":1}}`. Read pagination totals from `page`, use zero-based page numbers, and keep size between 1 and 100. Entries are ordered by descending ledger sequence.

Use `/sandbox-wallets/convert/quote` with `{"sourceCurrency":"USD","targetCurrency":"EUR","amount":10}` to preview. `/sandbox-wallets/convert` with an idempotency key executes synchronously, posting two linked ledger entries. Quotes reserve nothing; execution uses current configured synthetic rates and zero fees. Funding/conversions do not generate payment webhooks. These endpoints reject LIVE credentials.

Default sandbox payment fees are internal 0.10 and external 0.20 **in the requested fiat currency**; administrators may change fixtures. Synthetic rates and fees do not predict real charges or market rates.

## Handle request errors

Merchant endpoint errors contain `message`, `status`, `statusCode`, `errorCode`, and `requestId`; optional `details` can contain validation field errors. `X-Request-Id` matches the body. Match on codes/status, not display text. An HTTP request error is distinct from an accepted payment that later fails.

| HTTP status | Action |
| --- | --- |
| 400 | Correct headers, field values, JSON, precision, method/network, currency or amount; inspect the error |
| 401 | Check the credential and whether it was revoked; do not send a portal JWT |
| 403 | Check Business ownership, access/account restrictions, or use of LIVE credentials on a sandbox operation |
| 404 | Check Business/environment and exact payment reference |
| 409 | The idempotency key belongs to different content; recover the original intent before creating a new one |
| 429 | Back off; observe applicable quotas, including the UTC top-up limit |
| 500/503 or connection timeout | Preserve the intent/reference and retry with backoff using the same key; reconcile before creating another payment |

A framework error on an unknown URL outside the documented merchant handlers can have a different shape. Do not infer payment failure from a polling/network error. If polling returns UNKNOWN/manual review, stop automatic replacement and investigate. Include the payment reference, Business ID and request ID when contacting support, without sharing credentials.

The [Postman collection](postman.v1.json) contains sandbox guards. Set `apiKey` locally, `businessId`, and a unique `intent` once per logical run. It captures accepted payment references for polling but does not wait for worker completion automatically. Keep exported/shared credentials blank.
