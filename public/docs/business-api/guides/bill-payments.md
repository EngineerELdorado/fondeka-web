> Bill payments are available when enabled for your account. Check the API guides in your portal for availability.

# Bill payments

Use one payment contract for every supported bill: select a product, identify the customer and submit the payment. Biller-specific inputs belong in optional `additionalInfo`. New billers, categories and input requirements use the same URLs and envelope.

The design follows the common-envelope approach in [Reloadly's Pay Bill reference](https://docs.reloadly.com/utility-payments/Pay-Bill?lang=ruby), while retaining Fondeka product codes, wallet currency, asynchronous processing, idempotency and signed webhooks.

All paths below start with `/business-api/v1/businesses/{businessId}`. Authenticate with `X-API-Key`. The key selects LIVE or SANDBOX. Responses use `Cache-Control: no-store`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bill-products?countryCode=CD&category=ELECTRICITY` | Discover products; both filters are optional |
| GET | `/bill-products/{billProductCode}` | Read the same compact product resource |
| GET | `/bill-products/{billProductCode}/offers?displayCurrency=USD` | Packages or fixed denominations, when applicable |
| GET | `/bill-products/{billProductCode}/offers/{offerCode}/options?displayCurrency=USD` | Options belonging to an offer, when applicable |
| POST | `/bill-products/{billProductCode}/account-lookup` | Validate or look up a customer/account |
| POST | `/bill-payments` | Accept an idempotent bill payment |
| GET | `/bill-payments/{reference}` | Read status and available delivery details |
| GET | `/bill-payments/{reference}/receipt` | Read receipt or electricity tokens |
| GET | `/bill-payments?page=0&size=20&orderReference=invoice-123` | Business-scoped history, optionally filtered by merchant reference |
| POST | `/bill-payments/{reference}/actions` | Run an available follow-up action on the captured payment |

No category appears in these paths. Omitting `countryCode` defaults to the owner's country. `category` is an optional, case-insensitive string filter; omitted filters return the complete eligible catalog. Product `code`, `name` and `category` are strings so clients can handle future values without new enum classes.

Current rollout eligibility remains non-gift-card electricity, water and TV products. Other categories and gift cards remain excluded, including gifts assigned an otherwise eligible category. Future billers still require backend/provider support and eligibility configuration, but do not require another public endpoint or request model.

## Product and offer resources

Product lists and individual product reads contain exactly four fields:

```json
{"code":"SOCODEE","name":"SOCODEE","displayName":"Socodée","category":"ELECTRICITY"}
```

Use the `code` from your catalog and selected market. Product names and country-specific product codes are distinct; for example, use `CANAL_PLUS_DRC` rather than the shared name `CANAL_PLUS`. Account-specific activation rules remain enforced.

Offers and options contain `code`, `name`, `price` and `currency`. Options are fetched using the parent offer code. A customer-facing note appears only when available. An offer may include `additionalInfo` with necessary selectors or requirements, such as a biller-supplied fixed-denomination `amountId`, `requiresInvoice` or `useLocalAmount`. These biller selectors are distinct from Fondeka database IDs. Internal costs, route IDs, raw provider payloads and FX configuration are excluded. Requested display prices come from the existing bill engine. The backend applies current pricing when processing the payment.

There is no product form definition or list of possible operations to interpret before making an ordinary payment.

## Common payment request

```http
POST /business-api/v1/businesses/42/bill-payments
X-API-Key: <api-key>
Idempotency-Key: electricity-order-1
Content-Type: application/json
```

```json
{
  "billProductCode": "SOCODEE",
  "accountNumber": "CUSTOMER-101",
  "amount": 10,
  "currency": "USD",
  "orderReference": "invoice-123",
  "additionalInfo": {
    "invoiceId": "INVOICE-1"
  }
}
```

Only `billProductCode`, `accountNumber`, `amount` and `currency` are required. Codes are matched case-insensitively after trimming surrounding whitespace. Numeric product IDs are not accepted in payloads or product paths. The backend resolves database IDs internally. The account number can identify a meter, water customer, TV subscriber or another supported bill account. Send identifiers as strings. Omit `additionalInfo` when no extra information is needed. `orderReference` is your optional merchant correlation value; it does not replace `Idempotency-Key`.

Submit the payment directly. The backend validates the bill, calculates applicable fees and debits the total automatically. There is no customer review or confirmation step. The response includes `amount`, `fee`, `grossAmount` and `currency` for reconciliation.

Optional top-level `maxFee` and `maxGrossAmount` are automated spend limits and can be omitted. Exceeding a configured limit rejects the payment before any debit.

Payments debit the existing `FONDEKA_BALANCE` fiat balance in `currency`.

## Additional information

The server maps `additionalInfo` into the existing validated bill inputs. Common supported keys include `invoiceId`, `amountId`, `useLocalAmount`, `inputCurrencyCode`, `serviceId`, `customerId`, `subscriptionNumber`, `offerCode`, `optionCode` and `operation`. The existing paired `requestedAmount`/`requestedCurrency`, opaque `metaData` and `providerFields` inputs remain available.

Other biller-specific keys use the existing provider-fields channel. Scalars are preserved as field values; objects and arrays are encoded as stable JSON values. A new biller can therefore add inputs without another route or top-level DTO property. The selected backend/provider must support those inputs; accepting an extension envelope does not invent unsupported financial behavior. Existing field, amount and size validations still apply. `providerFields` also accepts the existing list format or an object keyed by field name.

Core amount, currency, identity, wallet, provider-route and price-limit controls cannot be overridden through `additionalInfo`. Conflicting flat and nested versions of the same selector are rejected instead of silently choosing one.

### TV example

An ordinary TV bill uses the same basic request. Existing Canal+ subscription products retain their renewal/change requirements. Select the subscription returned by account lookup:

```json
{
  "billProductCode": "CANAL_PLUS_DRC",
  "accountNumber": "SUBSCRIBER-101",
  "amount": 10,
  "currency": "USD",
  "additionalInfo": {
    "operation": "TV_RENEW",
    "subscriptionNumber": "SUBSCRIPTION-1"
  }
}
```

For an existing TV offer change, use `operation: "TV_CHANGE"` and include the selected `offerCode` and `optionCode` in `additionalInfo`. Renewal retains its existing optional offer/option inputs. The default operation is the existing `PAY`. All operations keep the same pricing, minimums, validation and currency rules as before. Supply the required amount and currency from the bill/subscription data; the backend validates them and applies fees automatically.

## Customer lookup

```json
{"accountNumber":"CUSTOMER-101","displayCurrency":"USD","additionalInfo":{"invoiceId":"INVOICE-1"}}
```

Send this to `/bill-products/{billProductCode}/account-lookup`. `displayCurrency` and `additionalInfo` are optional. Lookup-specific extra data reaches the existing opaque metadata input; no payment is started.

The result contains `accountNumber`, `name` when available and optional `additionalInfo`. Additional data appears only when relevant, such as an address, subscriptions or payment requirements. Subscription details retain identifiers, offer/name, expiry, existing price/currency, renewal availability and an available customer-facing note. Provider configuration, internal costs and FX rates are omitted. Use returned payment requirements and the selected subscription/offer; do not blindly copy display data into a payment request.

## Status, receipts and webhooks

HTTP `202` means accepted, not completed. Keep the original `fondekaReference` and poll `/bill-payments/{reference}` or consume the existing signed `business_api.bill_payment.completed` / `business_api.bill_payment.failed` webhook.

Payment responses retain reference/correlation, environment, `billProductCode`, account, status, amounts, refund state, delivery details and safe failure information. Product, offer and option database IDs are omitted from all bill resources and bill webhooks. Redundant service/action fields and internal fee breakdowns are omitted from bill HTTP resources. Receipt responses retain tokens and results; nested TV data excludes internal costs/configuration. History uses the same compact payment resource.

`ACCEPTED` and `PROCESSING` are unresolved. Do not submit a replacement while an outcome is uncertain. `FAILED` does not necessarily mean refunded: inspect `refunded`. Existing TV provider review policy can retain rejected or uncertain purchases for operational review without a terminal webhook. That policy is unchanged.

Use the same idempotency key and equivalent normalized input after a timeout. Equivalent flat biller-specific inputs and the `additionalInfo` format map to the same internal intent, so regrouping values does not create another debit. Retain opaque string values exactly on retries. Changed intent returns `409 IDEMPOTENCY_CONFLICT`.

Webhook event names, signing, delivery retries and business/environment scoping are unchanged. Bill webhook data identifies the product by `billProductCode`. LIVE and SANDBOX share these paths. Sandbox remains provider-free and supports the existing advertised `X-Simulate-Error-Code` outcomes.

## Follow-up actions

```http
POST /business-api/v1/businesses/42/bill-payments/TX123/actions
```

```json
{"action":"REACTIVATE"}
```

The action envelope is extensible; the server currently supports `REACTIVATE` for an owned, completed TV subscription. It uses the originally captured subscriber and subscription, accepts no replacement details and creates no payment, debit or additional bill-payment webhook. Existing queue deduplication and sandbox behavior remain authoritative. Unsupported actions are rejected without side effects. Future actions can use the same URL and optional `additionalInfo` after backend support is added.

Existing `/bill-payments/{reference}/reactivate` requests remain accepted as a deprecated alias. Existing flat payment fields and lookup `metaData` strings remain accepted for compatibility; new integrations should use `additionalInfo`.

No financial engine, pricing, provider execution, refund policy, wallet behavior or enrollment flow was changed by this contract restructuring. No new migration is required for the restructuring; the original bill API migration is still required for installations that have not enabled bill payments yet.
