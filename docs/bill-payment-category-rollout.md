# Bill API availability by category

The Business API and its guides can enable bill categories independently. Current categories are `ELECTRICITY`, `WATER` and `TELEVISION`.

| Category    | Feature flag                                   |
| ----------- | ---------------------------------------------- |
| Electricity | `business_api.bill_payments.electricity.ready` |
| Water       | `business_api.bill_payments.water.ready`       |
| Pay TV      | `business_api.bill_payments.television.ready`  |

Flags appear in the existing admin flag list and support existing account overrides. A category resolves the account category override first, then the global category flag. If neither is configured, it inherits the account override or global value of the existing `business_api.bill_payments.ready` flag. An explicit category setting overrides the old whole-bill setting, including when that old setting is false. Missing settings are not persisted as new false overrides.

To launch electricity while keeping TV unavailable, enable the electricity flag and disable the television flag. Leave water inherited or configure it explicitly. The normal bill service switch, account access, product eligibility and separate LIVE payment launch control still apply. These category flags affect the Business API; they do not change the customer app’s shared bill engine.

## Backend behavior

Business discovery and public guide availability add `billPaymentsApiAvailability`:

```json
{
  "billPaymentsApiReady": true,
  "billPaymentsApiAvailability": {
    "ELECTRICITY": true,
    "WATER": false,
    "TELEVISION": false
  }
}
```

The old boolean is true when any category is ready. Public guides use global settings, while authenticated Business discovery resolves the owner’s account overrides. Public guide availability is uncached and refreshes on opening, returning to the page and every 60 seconds. Authenticated discovery and payment admission read category settings without the general flag cache.

The bill product list filters disabled categories before returning results. A new payment for a disabled category returns `403 FEATURE_DISABLED` before provider validation, request creation or wallet movement, in both LIVE and SANDBOX. Admission checks the category after checking for an existing matching idempotency intent. Accepted payments therefore remain replayable when a category is disabled. Status, receipts, historical list reads and existing TV reactivation retain their existing access rules. Read-only direct product lookup, pricing and electricity estimates retain their existing rules. Queued execution and refund behavior are unchanged.

## Guide behavior and compatibility

Desktop navigation, mobile options, saved links, progress and Next/Back use each lesson’s `billCategory`. Pay Electricity and the kWh estimate require `ELECTRICITY`; Pay TV requires `TELEVISION`. Shared reference lessons open when any category is ready. A disabled category remains visible with Coming soon and cannot be opened through a direct lesson URL.

An explicit availability map is authoritative: missing categories, malformed values and string `"true"` do not enable a category. An older backend without the map retains the previous all-or-nothing boolean behavior. New category names can pass through the map without a frontend enum change. Supporting a new payment category still requires the backend/provider integration, inclusion in the backend’s category list and any new payment lesson/menu entry with its `billCategory`.

Deploy backend admission and discovery with the guide changes. No database migration is needed; the existing flag and account override tables store these settings.

## Product opt-in

API availability also requires an enabled product flag. **SOCODEE and VIRUNGA default to enabled; all other product codes default to disabled.** This does not enable a category, change normal app availability, grant account access or bypass the separate LIVE payment launch control.

| Product        | Flag                                                | Default  |
| -------------- | --------------------------------------------------- | -------- |
| SOCODEE        | `business_api.bill_products.socodee.enabled`        | Enabled  |
| VIRUNGA        | `business_api.bill_products.virunga.enabled`        | Enabled  |
| SNEL           | `business_api.bill_products.snel.enabled`           | Disabled |
| REGIDESO       | `business_api.bill_products.regideso.enabled`       | Disabled |
| CANAL_PLUS_DRC | `business_api.bill_products.canal_plus_drc.enabled` | Disabled |

Admins manage these in the existing **Feature Flags** screen. For another supported product, create `business_api.bill_products.<lowercase_product_code>.enabled` and enable it. Existing account overrides work on these keys too. Deleting a configured flag restores its default, so disable SOCODEE/VIRUNGA explicitly to turn them off. Product admission reads are uncached.

Product opt-in filters merchant discovery and both documentation catalogs, and is required for direct product inputs, lookup, pricing, estimates and new payment acceptance. Matching accepted intents are replayed before this check; status, history, receipt reads and existing TV reactivation remain available under their existing rules.

## Live catalog in Get bill products

The guide shows current configured products using read-only documentation endpoints:

- `GET /public/business-api/bill-products`: global API availability, standard LIVE fees, no account resolution or commission data.
- `GET /customer-api/businesses/{businessId}/api-bill-products`: authenticated Business ownership, account-specific availability/fees and eligible own-purchase reseller commission rules.

Both accept `currency` (default `USD`) and optional ISO `countryCode`. Public discovery defaults to all markets; authenticated discovery defaults to the owning account’s country. The guide displays product information, configured fee schedules and applicable commissions, without amount simulation, filter controls or a wallet debit example. The Next.js public proxy forwards only supported filters and the interface language, with no account credentials.

The response includes `environment: LIVE`, `pricingScope: STANDARD | ACCOUNT`, `currency`, `calculatedAt`, `binding: false` and `products`. Each product has its public code/name/category/countries and a `feeSchedule` using the existing tariff shape: status, currency, requested-amount bands and combined percentage/flat/minimum expressions. Product, route and account overrides follow the normal fee precedence. Missing configuration is unavailable, never free. Charges requiring a full quote are marked unavailable rather than showing an incomplete tariff. Provider identifiers and cost splits are excluded.

No amount is required or calculated for the informational catalog. Optional `amount` remains supported for compatibility (range `0.01`–`1000000`, at most two decimals); only these explicit requests include an amount-specific `pricing` calculation in EXCLUSIVE mode. The guide does not send it or infer tariffs from it. These reads create no payment, wallet debit, provider invoice or reservation. The existing merchant `GET /business-api/v1/businesses/{businessId}/bill-products` response stays compact and unchanged.

`commission` is omitted from every public product and from private products without an applicable active reseller own-purchase rule. Private rules include `basis` (`NET_AMOUNT` or `REVENUE`), percentage in percent units and an optional `maxPoints` cap. These are reseller points earned on eligible completed purchases, not a discount against the wallet debit or an unconditional earnings promise.
