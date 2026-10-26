# Collect crypto with fiat settlement

A crypto collection creates an external invoice. It does not spend the Business owner's crypto balance. Request a fiat price, receive payment instructions, and settle confirmed net proceeds into the account's fiat wallet.

## Create the invoice

```http
POST /business-api/v1/businesses/{businessId}/collections
X-API-Key: YOUR_API_KEY
Idempotency-Key: crypto-invoice-1001:collection
Content-Type: application/json

{"amount":25,"currency":"USD","paymentMethodName":"USDT","networkName":"TRC20","clientReference":"crypto-invoice-1001","feeApplicationMode":"EXCLUSIVE"}
```

No payer address is required in `accountRef`. Choose a configured crypto method/network pair. The amount is **25 USD**, not an instruction to transfer an assumed 25 tokens. Live prices, minimums and fees apply.

## Retrieve payment instructions

Save `fondekaReference` and poll the transaction. Invoice creation is asynchronous, so `cryptoDetails` is omitted until available. Once available, show the returned address, crypto currency, network, token amount, invoice URL and expiry as appropriate. Use the exact returned token instructions; do not calculate them yourself or substitute another network. Do not invite payment to an expired invoice.

`exchangeRateCurrency` identifies the rate denomination: USD/token for LIVE, or the payment fiat currency/token for synthetic SANDBOX instructions. It can differ from the wallet currency. For example, a CDF-funded LIVE USDT invoice still has a USD/USDT rate.

## Confirm settlement

Verify the completion webhook and reconcile `currency` and `amount` against the order. On COMPLETED collections, `amount` is the reconciled net wallet credit; `grossAmount` and `fee` describe the same settlement. Underpayments/overpayments can differ from the initial quote; decide explicitly how your application handles those cases. An unconfirmed invoice or a 202 response does not credit the wallet.

Sandbox crypto instructions and rates are synthetic. Never send real crypto to sandbox addresses. See [testing](../testing.md), [amount semantics](../concepts.md) and [webhooks](../webhooks.md).
