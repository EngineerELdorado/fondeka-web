# Pay a crypto address from fiat

The request specifies a fiat amount. The backend quotes the net token amount and reserves/debits gross fiat, including fees, from the owning account wallet.

## Submit the payout

```http
POST /business-api/v1/businesses/{businessId}/payouts
X-API-Key: YOUR_API_KEY
Idempotency-Key: crypto-disbursement-1001:payout
Content-Type: application/json

{"amount":25,"currency":"USD","paymentMethodName":"USDT","networkName":"TRC20","accountRef":"YOUR_RECIPIENT_TRON_ADDRESS","orderReference":"crypto-disbursement-1001","feeApplicationMode":"EXCLUSIVE"}
```

Replace the destination with the recipient's valid address on the selected network. Wrong-network transfers can be unrecoverable. An enum's existence does not enable a payout method or route; confirm availability and your account's payout eligibility before going live.

With EXCLUSIVE, amount is net fiat before conversion and fees are added to gross. With INCLUSIVE, the amount is the gross fiat budget and fees reduce the net converted. Use returned `cryptoDetails` for the actual token currency, network and quantity; fiat fields remain fiat. Do not treat a fiat value as a token quantity.

## Reconcile the outcome

Save `fondekaReference`, wait for the signed terminal event and poll as needed. Completion does not debit again. A definite failure may refund the original gross debit according to policy; the compact payment object does not expose a refund flag. Reconcile wallet records or contact support if needed. A payment awaiting provider reconciliation remains PROCESSING. Investigate a long-running payment before creating another payout or assuming a refund.

Start with a SANDBOX key and virtual funds; sandbox uses synthetic token quantities and never calls providers. See [testing](../testing.md), [financial lifecycle](../concepts.md), and [webhook verification](../webhooks.md).

`X-Simulate-Error-Code` supports sandbox crypto payouts, including `CRYPTO_ADDRESS_INVALID`, `CRYPTO_NETWORK_UNAVAILABLE`, `CRYPTO_TRANSFER_REJECTED` and `CRYPTO_CONFIRMATIONS_PENDING`. A confirmations-pending payout retains its gross debit and emits no terminal webhook. See the [crypto simulation contract](../crypto-sandbox-simulations.md) for definite-failure refund rules and supported generic errors.
