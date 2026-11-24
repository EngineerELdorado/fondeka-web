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

The old boolean is true when any category is ready. Public guides use global settings, while authenticated Business discovery resolves the owner’s account overrides. Public guide discovery may be cached for up to 60 seconds; authenticated discovery and payment admission read the category settings without the general flag cache.

The bill product list filters disabled categories before returning results. A new payment for a disabled category returns `403 FEATURE_DISABLED` before provider validation, request creation or wallet movement, in both LIVE and SANDBOX. Admission checks the category after checking for an existing matching idempotency intent. Accepted payments therefore remain replayable when a category is disabled. Status, receipts, historical list reads and existing TV reactivation retain their existing access rules. Read-only direct product lookup, pricing and electricity estimates retain their existing rules. Queued execution and refund behavior are unchanged.

## Guide behavior and compatibility

Desktop navigation, mobile options, saved links, progress and Next/Back use each lesson’s `billCategory`. Pay Electricity and the kWh estimate require `ELECTRICITY`; Pay TV requires `TELEVISION`. Shared reference lessons open when any category is ready. A disabled category remains visible with Coming soon and cannot be opened through a direct lesson URL.

An explicit availability map is authoritative: missing categories, malformed values and string `"true"` do not enable a category. An older backend without the map retains the previous all-or-nothing boolean behavior. New category names can pass through the map without a frontend enum change. Supporting a new payment category still requires the backend/provider integration, inclusion in the backend’s category list and any new payment lesson/menu entry with its `billCategory`.

Deploy backend admission and discovery with the guide changes. No database migration is needed; the existing flag and account override tables store these settings.
