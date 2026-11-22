# Client app handoff: POS sales, payments and reports

Date: 21 November 2026

## Context and delivery status

Store owners and POS staff need to correct mistakes, record money received after the original sale, negotiate customer discounts, and produce professional reports. The web frontend now contains these flows. The client app needs the same behavior using its existing navigation, authentication, store permissions and native components.

**The backend implementation is now present, with rollout flags disabled by default.** Check the [backend integration and rollout guide](../../../backend/docs/commerce-pos-sale-management.md) for migration and configuration requirements. Both apps must continue to use explicit server feature flags and per-sale permissions. Preserve existing checkout, collection and report viewing when a flag is missing. Do not simulate successful writes or send unsupported fields to an older server.

The companion [backend integration contract](pos-sale-management-backend-contract.md) describes the required persistence, authorization, inventory, email and PDF worker behavior. Coordinate changes to that contract across backend, web and client app before enabling a feature.

Use the authenticated **customer Commerce API** for this work. The merchant Business API and its API keys are a separate integration. Reuse the client's customer session, device proof, language headers and existing HTTP client. Do not add merchant API keys to the app.

## What the user should be able to do

| Need                                 | Client experience                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| A customer returns to pay more       | Open the existing sale, select **Record a payment**, enter what was received, and see a new payment-history entry plus the updated balance. |
| The sale contains a mistake          | Select **Edit sale**, adjust the supported details, give a reason, review the server's correction preview, then save.                       |
| A sale was entered by mistake        | Select **Delete sale**, explain why, choose whether items return to stock, and confirm. The sale becomes VOIDED and retains its history.    |
| A customer bargains                  | Offer a fixed or percentage discount during checkout, with a reason. Show the original subtotal, discount and final quoted total.           |
| The owner controls correction access | Configure separate staff and owner correction windows in store settings.                                                                    |
| The owner needs a printable report   | Request a PDF, follow background-job progress, then open, share, save or print the completed PDF using native platform tools.               |
| The owner deletes a store            | Request an email code, enter it, acknowledge deletion and confirm with the server.                                                          |

These additions currently target **manual CASH POS sales**. Here CASH identifies the manually recorded sale workflow; later receipts can be cash, bank transfer, mobile money or another external method. Existing FONDEKA provider collection and refund workflows stay separate. Do not use these new manual operations on online orders or provider-managed sales.

## Finding sale actions and local rollout

Open **Store → Sales → Manage sale** on the web, or tap a sale in the client app. **Edit sale** and **Delete sale** appear at the top of the details. Unavailable actions remain visible and explain whether the store feature is disabled, the correction deadline has passed, the payment workflow is ineligible or access is insufficient.

All six POS feature flags were enabled on the local development backend on 21 November 2026 after confirming the POS migrations, private PDF upload/signing/download, SMTP authentication and a running report worker. The web and worker processes share the report bucket and a stable OTP signing secret stored in ignored, owner-only local configuration. Generated POS PDF files have a two-day storage retention rule in addition to application expiry. This changed no sale records. Reload the web page or pull to refresh the sale in the client app to reload Store features and per-sale actions; the server flag cache lasts up to 30 seconds.

Feature activation never overrides owner/staff permissions, CASH POS eligibility or the configured correction window. Fresh environments still require the feature flags and supporting services to be configured before activation. Do not copy the local OTP secret into documentation or source control.

## 1. Models, feature support and permissions

Add optional Store fields:

```json
{
  "posFeatures": {
    "discounts": true,
    "installments": true,
    "corrections": true,
    "correctionPolicy": true,
    "reportExports": true,
    "emailDeletion": true
  },
  "posCorrectionPolicy": {
    "version": 0,
    "staffWindowHours": 24,
    "ownerWindowHours": 168
  }
}
```

Missing or false flags mean unavailable. Show a clear unavailable state and keep existing supported actions usable. Do not probe unsupported write endpoints or silently fall back to an older operation.

Add optional Order fields:

```json
{
  "version": 4,
  "posActions": {
    "canRecordPayment": true,
    "canCorrect": true,
    "canVoid": true,
    "correctionAllowedUntil": "2026-11-22T10:00:00Z"
  },
  "payments": [],
  "auditTrail": [],
  "discount": {
    "type": "PERCENTAGE",
    "value": 10,
    "reason": "Customer negotiation"
  },
  "subtotalBeforeDiscountAmount": 100,
  "discountAmount": 10,
  "discountCurrency": "USD"
}
```

Treat these as additions to existing resources, not replacement resource definitions. The example's monetary fields describe a discount snapshot, not a complete payment or fee calculation.

Apply the client's existing store capability resolver to owned and shared stores. An explicit capability denial takes precedence over an owner/staff label. POS permission is required for these sale mutations; SALES viewing permission alone does not authorize them. Store settings/deletion require owner store-management rights; reports require REPORTS permission. Feature flags indicate deployed functionality and do not grant access.

For each sale, enable an action only when the feature, store permission and corresponding `posActions` value explicitly allow it. Require a valid numeric order version, the correct store/reference, POS channel and an eligible payment mode/status. A correction or void also needs an unexpired `correctionAllowedUntil`. The server owns deadline enforcement; the app's clock/display cannot grant extra time.

Later payments have their own permission and positive outstanding-balance check. They must remain possible after the correction window closes. A VOIDED sale cannot be corrected or receive another payment.

For status display, prefer `posPaymentStatus` over generic `status`. Use `balanceDue` / `balanceDueCurrency`, with the existing `outstandingAmount` / `outstandingCurrency` fallback for older resources. Missing amounts remain unknown; do not replace them with zero or invent a payment history for legacy sales.

## 2. Endpoint map

All paths below use `S = /customer-api/commerce/stores/{storeId}`. Encode and validate the order reference and job ID before constructing paths.

| Method and path                                   | Purpose                                                              | Status                                    |
| ------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| `GET S/pos/orders/{reference}`                    | Read a POS order using store permissions                             | Existing                                  |
| `POST S/pos/orders/quote`                         | Quote a new sale; optional discount support is new                   | Existing route, extended body/response    |
| `POST S/pos/orders`                               | Create a sale with the confirmed discount snapshot                   | Existing route, extended contract         |
| `POST S/pos/payments/quote`                       | Existing FONDEKA payment quote; must include discounted sale context | Existing route, extended contract         |
| `POST S/pos/orders/{reference}/payments`          | Append a later manual receipt                                        | Implemented; requires server support flag |
| `POST S/pos/orders/{reference}/corrections/quote` | Preview a correction without changing anything                       | Implemented; requires server support flag |
| `POST S/pos/orders/{reference}/corrections`       | Apply the reviewed correction                                        | Implemented; requires server support flag |
| `POST S/pos/orders/{reference}/voids`             | Void a sale with a retained audit trail                              | Implemented; requires server support flag |
| `PATCH S/pos/correction-policy`                   | Save owner-configured correction windows                             | Implemented; requires server support flag |
| `GET S/reports/sales`                             | Existing on-screen JSON report                                       | Existing                                  |
| `POST S/reports/sales/exports`                    | Queue a PDF export                                                   | Implemented; requires server support flag |
| `GET S/reports/sales/exports/{jobId}`             | Read export progress and download information                        | Implemented; requires server support flag |
| `POST S/deletion-challenges`                      | Email the owner a store-deletion code                                | Implemented; requires server support flag |
| `POST S/deletion-confirmations`                   | Verify the code and delete the store                                 | Implemented; requires server support flag |

Payment, correction, void and export creation POSTs require an `Idempotency-Key` header. A correction preview does not require one. Keep the existing provider-payment API's own idempotency behavior intact. Do not substitute the manual receipt endpoint for provider payment initiation.

## 3. Sale detail and later payments

Make sale history and customer sales easy to reach from POS. On sale detail, show total, paid amount, remaining balance, due date, payment status, discount, payment history and sale activity. Place **Record a payment** prominently when money remains due.

The payment form needs:

- Amount in the outstanding balance's currency, with a **Use full balance** shortcut.
- Method: `CASH`, `BANK_TRANSFER`, `MOBILE_MONEY` or `OTHER`.
- Actual receipt date/time, converted from local input to a UTC ISO timestamp.
- External reference, required for every method except CASH; maximum 128 characters.
- Optional note, maximum 500 characters.
- Confirmation that the money has actually been received.

Send:

```json
{
  "expectedVersion": 4,
  "amount": 20,
  "currency": "USD",
  "method": "CASH",
  "receivedAt": "2026-11-21T12:30:00Z",
  "reference": "receipt-002",
  "note": "Second installment"
}
```

Validate positive amount, currency precision, no overpayment and receipt time between sale creation and now. Never expose `amountPaid` as a freely editable aggregate. This operation records money already received outside Fondeka; it must not initiate a charge or claim that a Fondeka wallet was credited.

The response is the complete updated Order. Payment entries contain `id`, `amount`, `currency`, `method`, `receivedAt`, `recordedAt`, `recordedBy`, optional `reference` and `note`. Show receipt time separately from server recording time and identify the recorder. The backend determines the updated payment status and balance.

After confirmed success, refresh the sale, sales list, customer history/balance, report data and receipts. Inventory/product views also need invalidation after a correction or void. Do not patch only the current screen and leave other totals stale.

## 4. Discounted checkout

Add an optional **Offer a discount** section before sale review. Provide percentage/fixed choices, value and a required reason of up to 500 trimmed characters.

Percentage request:

```json
{ "type": "PERCENTAGE", "value": 10, "reason": "Customer negotiation" }
```

Fixed request:

```json
{ "type": "FIXED", "value": 10, "currency": "USD", "reason": "Customer negotiation" }
```

Attach this object as `discount` to the existing POS quote/create payload. Fixed discounts use the billing currency, which can differ from the payment currency. Percentages must be greater than zero and below 100, with at most two decimal places. Fixed values follow currency precision and must leave a positive eligible subtotal, as validated by the server. Omit `discount` entirely when disabled on a new sale.

Changing cart contents, currencies or discount details invalidates both the sale quote and any payment-fee quote/confirmation. Recalculate through the existing quote workflow. The server determines fees, FX and the final amount; the app must not adjust a final total locally and submit it as authoritative.

A quote accepting a discount must echo matching `type`, `value`, `currency` where applicable, and `reason`, plus a positive `discountAmount`. It also returns `subtotalBeforeDiscountAmount` and `discountCurrency`. Reject a quote that ignores or changes the requested discount. Never continue checkout at the undiscounted price after showing a discount to the user.

Display the original subtotal, discount amount/reason, existing fee breakdown and final total. Preserve the snapshot in sale detail and receipts. Do not change the product's catalog price. Preserve the existing FONDEKA payment workflow, and ensure its contextual quote receives the discounted sale payload.

## 5. Corrections and sale deletion

### Correct sale

Match the current web scope: quantities of existing sale lines, customer display name, payment due date and the sale discount. Keep paid receipts in their separate history. Do not add arbitrary catalog-price or aggregate-payment editing.

1. Fetch the latest sale and verify the current action permission/version/deadline.
2. Let the user change supported details and enter a required reason, maximum 500 characters.
3. Quantities are whole numbers. A UI quantity of zero removes the line from the submitted `items` set. Keep at least one line; use sale deletion when removing the entire sale.
4. Send the correction preview request. It does not mutate stock, money or the sale.
5. Show revised total, payments retained and new balance due. If `refundRequiredAmount > 0`, block saving and explain that a separate refund must be resolved.
6. Apply only the reviewed, unexpired quote. Any form edit invalidates it.

Preview body:

```json
{
  "expectedVersion": 4,
  "items": [{ "productId": 11, "quantity": 2 }],
  "buyerName": "Maya Customer",
  "paymentDueDate": "2026-12-31",
  "discount": null,
  "reason": "Missed second item at checkout"
}
```

In a correction, `discount: null` explicitly removes a discount. A non-null object uses the checkout discount shape. Correcting `buyerName` changes the sale's display snapshot, not the customer's identity or account record.

The preview returns `quoteId`, `orderVersion`, `expiresAt`, `totalAmount`, `totalCurrency`, existing Quote fields, `amountPaid`, `balanceDue` and `refundRequiredAmount`. Validate the order version, currency, finite/nonnegative amounts, positive total and future expiry. All three balance/payment/refund amount fields use `totalCurrency`.

Apply by sending the same reviewed body plus `quoteId` to `/corrections`, with an idempotency header. Historical line-price/fee/FX handling belongs to the backend contract. Do not reprice historical lines from today's client-side product cache.

### Delete sale

The user-facing **Delete sale** action is an audited void, not physical removal of financial evidence. Require a reason and an inventory choice:

```json
{
  "expectedVersion": 4,
  "reason": "Duplicate sale entered by mistake",
  "inventoryDisposition": "RESTOCK"
}
```

The alternative inventory value is `DO_NOT_RESTOCK`. Explain that original details, payment entries and the deletion reason remain available, and that voiding does not automatically refund money. Require explicit acknowledgement before posting to `/voids`.

After success, show VOIDED, disable further mutations and retain access to history/receipts. Never label an already received payment as refunded without actual refund evidence.

Activity entries have `id`, `type`, `createdAt`, `actorName`, optional `reason` and `summary`. Types are `CREATED`, `CORRECTED`, `VOIDED` and `PAYMENT_RECORDED`. The server retains structured before/after evidence; display its safe summary and actor/time/reason.

## 6. Owner correction-window settings

Add **Sale correction windows** to owner store settings. Read values from `posCorrectionPolicy`; send the current policy version with the edited whole-hour windows:

```json
{ "version": 0, "staffWindowHours": 24, "ownerWindowHours": 168 }
```

For parity, the web accepts 0–8760 hours, and the owner window must be at least the staff window. Zero disables corrections for that role. The 24-hour staff / 168-hour owner values are suggestions only when no policy exists; do not show them as saved or enable unsupported policy writes.

Windows start at sale creation, not the latest edit or payment. The backend computes each viewer's deadline and must consistently apply policy changes. After a successful settings response with an incremented version, refresh Store and relevant sale permissions. On a version conflict or uncertain save, refresh before offering another edit; do not overwrite a concurrent policy change blindly.

## 7. Recoverable writes and concurrency

Use one shared operation/recovery layer for later payments, corrections and voids. Export creation can use the same idempotent command mechanism.

Before the first POST, durably save an intent containing the exact endpoint, idempotency key and serialized body. Scope it to the signed-in account, store, sale where applicable, and operation. Reuse that key and the identical body when recovering a lost response, including the original `expectedVersion` and `quoteId`. Do not rebuild a recovered request from edited fields or a newer sale version.

Disable duplicate taps and freeze inputs while submitting or recovering. If one sale mutation has an unresolved outcome, block other mutations for that sale. Provide a visible **Recover payment/correction/deletion** action with the saved amount/reference or reason, including after navigation or an app restart. A newly closed correction window or a newly paid balance must not hide recovery of an earlier attempt; the server decides whether that original operation already completed.

Use the client's existing protected persistence and session lifecycle. Do not persist OTPs, auth tokens inside an operation record, or signed PDF URLs. Clear cached sensitive data and scope-specific recovery/job state on logout/account changes, cancel polling, and discard late responses from a previous identity. If recovery data was lost, require reconciliation of the existing sale before allowing another potentially duplicate operation.

| Outcome                                                                     | Required client behavior                                                                                                                     |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified success                                                            | Confirm same store/reference, numeric version greater than the original `expectedVersion`, then clear the intent and refresh dependent data. |
| Network failure, timeout, 5xx, unreadable or mismatched success response    | Retain the original intent. Show an unresolved result and offer recovery with the same key/body.                                             |
| `409 SALE_VERSION_CONFLICT` on a new attempt                                | No update was accepted. Refresh the sale and require review before a new intent.                                                             |
| `409 IDEMPOTENCY_CONFLICT` or an unknown conflict                           | Preserve evidence; do not generate another key to bypass it.                                                                                 |
| Authentication/device recovery or throttling                                | Keep the intent. Resume authentication or respect backoff before recovering the same operation.                                              |
| Definitive validation/permission/unsupported rejection on the first attempt | Show the error and allow a corrected draft only after confirming that the original attempt was rejected without side effects.                |
| Rejection while recovering an earlier uncertain attempt                     | Do not assume the earlier attempt failed. Retain recovery and reconcile; a prior request may already have completed.                         |

The web treats first-attempt 400/403/404/405/422/501 responses and explicit `SALE_VERSION_CONFLICT` as definitive rejections. It retains intents for ambiguous outcomes and recovered-request rejections. Match the agreed backend error semantics rather than classifying by translated message text.

An idempotent replay may return its original operation snapshot while the sale has since advanced further. Complete recovery, then refresh the sale; do not replace a newer cached sale version with an older replay result.

## 8. Reports, PDF downloads and native printing

Continue using the existing JSON report for on-screen data. Optional additions are `discountAmount`, `voidedOrderCount`, `voidedSalesAmount`, `paymentsReceivedAmount` and `paymentsReceivedCurrency`. Display only fields actually returned.

Keep these accounting concepts distinct:

- Sales and cumulative paid/balance values for sales in the selected sale period.
- Money received during the selected receipt period, including installments on older sales.
- Discounts, voided sales and actual refund evidence.

Do not calculate cash received in a period by simply summing the current `amountPaid` of sales created in that period. Do not sum different currencies without a server-provided conversion basis.

### Export flow

On the web, **Report PDF** is a button beside **Refresh**. It opens a compact dialog; export controls stay hidden until requested. The dialog shows the selected period/currency and a short status, with **Open PDF** as the primary action when ready. A new export is a secondary action. Request IDs, request timestamps and a separate layout preview are omitted. Manual refresh is offered when automatic polling stops, a read fails or the download link needs refreshing. Retain the original job's period when it differs from the current filters.

1. Capture the displayed report's resolved `fromDate`, `toDate` and currency, plus the requested language/timezone.
2. POST a new idempotent export request once.
3. Save the returned job ID scoped to account/store. The job is owned and processed by the backend, independently of the app being open.
4. Show queued/processing progress. Poll with increasing delays (web: 2, 4, 8, then at most 15 seconds; maximum 12 automatic reads), stop on failure/terminal status, and offer **Check progress**.
5. Pause polling in the background. On foreground/resume, fetch the saved job; do not create another export. Changing report filters must not relabel an older job as if it used the new filters.
6. On completion, open/download the PDF and offer native share/save/print actions using the app's existing supported tools.

Request:

```json
{
  "from": "2026-11-01",
  "to": "2026-11-21",
  "currency": "USD",
  "language": "en",
  "timeZone": "Africa/Kinshasa",
  "format": "PDF",
  "includeDetails": true
}
```

Job resource:

```json
{
  "id": "job-1",
  "storeId": 1,
  "status": "COMPLETED",
  "createdAt": "2026-11-21T13:00:00Z",
  "fromDate": "2026-11-01",
  "toDate": "2026-11-21",
  "currency": "USD",
  "language": "en",
  "expiresAt": "2026-11-21T14:00:00Z",
  "downloadUrl": "https://approved-files.example/report.pdf?signature=..."
}
```

Handle `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED` and `EXPIRED`; failed jobs may include a safe `errorMessage`. Validate store/job identity and the original filters/language. A usable download requires COMPLETED, an unexpired explicit expiry and an absolute HTTPS URL without embedded credentials. Fetch fresh authorized job information for an expired link or offer a new export. Never log or persist signed URLs.

The backend generates the actual PDF from a complete saved report snapshot. Do not build the financial report by screenshotting a mobile view or exporting only a visible page of rows. Use an app-private temporary download location, validate the PDF response, and pass the resulting file to the native viewer/share/print workflow.

The shared visual direction is a white A4 document with store logo/name/contact details, navy masthead, report period/currency, clear summary cards, readable tables, page numbers and a restrained footer. The complete PDF needs sales, discounts, payment entries, receivables and correction/void evidence. A client-side layout preview is optional and must be labelled as a preview. The backend contract contains the full document requirements.

## 9. Email-confirmed store deletion

Replace the existing direct store-delete confirmation flow. Do not call the old unverified `DELETE /stores/{id}`, including as a compatibility fallback.

1. Owner selects **Delete store** and sees the deletion consequences.
2. On **Send verification code**, POST `{}` to `/deletion-challenges`. The backend emails the owner's verified account address; the user cannot select an arbitrary recipient.
3. Show `maskedEmail`, a six-digit code field, expiry and the server's resend cooldown. Support the platform's one-time-code autofill where available.
4. Require acknowledgement, then send the challenge ID/code to `/deletion-confirmations`.
5. Navigate away and invalidate store lists, POS store selection and that store's cached data only after verified success.

Challenge response:

```json
{
  "challengeId": "challenge-1",
  "storeId": 1,
  "maskedEmail": "o***@example.test",
  "expiresAt": "2026-11-21T13:05:00Z",
  "resendAfter": "2026-11-21T13:01:00Z"
}
```

Confirmation body:

```json
{ "challengeId": "challenge-1", "code": "123456" }
```

Success must explicitly return the target `storeId` and `deleted: true`. Handle invalid, expired and exhausted codes without claiming deletion. Respect `resendAfter`, clear the old code on resend, and disable submission after expiry. Keep codes in memory only, never in analytics/logs or URLs. Email delivery, code validation, attempt limits and atomic deletion belong to the backend. A lost confirmation response requires checking/recovering that same challenge safely, not falling back to unverified deletion.

When `emailDeletion` is missing or false, explain that verified deletion is unavailable and provide the existing support route. The web gateway has already blocked unverified deletion; the backend also needs to protect the old endpoint for every client.

## 10. Client implementation and acceptance checklist

Implement using the client's existing design system, localization, monetary precision, date formatting, permission helpers and native file handling. Provide English and French copy. Keep calendar-only due dates unchanged across timezones; convert receipt instants correctly and use the report's specified timezone for reporting boundaries.

Recommended implementation order:

1. Extend models, permission checks, API methods and durable idempotent operation recovery.
2. Add sale-detail payment/activity history and later payment recording.
3. Add checkout discounts and quote invalidation/verification.
4. Add correction preview/apply and audited sale deletion.
5. Add owner correction-window settings.
6. Add export job recovery, PDF viewing/sharing/printing, then email-verified store deletion.
7. Run integration tests with synthetic API fixtures before enabling backend flags.

Acceptance cases:

- A sale of 100 with 30 paid receives another 20: history contains a separate receipt, paid becomes 50 and due becomes 50. Paying the final balance settles the sale. The server determines final figures.
- Zero, negative, overpaid, wrong-currency and excessive-precision payments are rejected. External receipts require a reference.
- Duplicate taps, a lost response, navigation, app termination/restart and reauthentication never create a second receipt/correction/void.
- An expired correction window prevents new corrections/voids but still permits authorized later payments. Recovery of an earlier uncertain operation stays visible.
- Staff cannot use owner settings; SALES-only access does not grant POS writes; explicit permission revocation prevents further mutations.
- Stale versions require refresh/review. Editing a preview invalidates it. Expired/mismatched quotes and corrections requiring a refund cannot be applied.
- A 10% discount on eligible merchandise worth 100 appears as 10 before subsequent fees/FX. A quote that ignores it cannot advance checkout. Catalog prices remain unchanged.
- Voiding retains payment/audit evidence, applies the selected stock handling through the server, disables future mutations and never claims an automatic refund.
- Policy suggestions are not presented as configured values. Version conflicts cannot silently overwrite another settings change.
- PDF progress survives leaving/reopening the report. Failed/expired jobs are handled, old job filters remain accurate, and expired/unsafe URLs cannot open. Large reports contain all server-selected rows.
- Wrong/expired OTPs, resend cooldowns, repeated taps and absent feature support cannot delete a store. No unverified DELETE fallback exists.
- Missing fields from older servers keep old supported flows working. No new operation is optimistically marked successful before a verified response.
- Cross-account/store navigation cannot restore another account's intent, show another store's report, or apply a late response to the current screen.

## Web implementation references

These paths belong to the web repository and provide behavioral reference; adapt them to the client app rather than copying browser-specific code.

| File                                                   | Reference                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/lib/pos-management.ts`                            | Models, action checks, discount/policy validation and response validation |
| `src/lib/pos-command.ts`                               | Persist-before-send idempotent operations and recovery/error semantics    |
| `src/components/sale-management.tsx`                   | Payment entry/history, correction preview/apply and audited deletion UI   |
| `src/components/pos-discount.tsx`, `pos-register.tsx`  | Discount fields and checkout integration                                  |
| `src/components/store-pos-policy.tsx`                  | Owner correction-window settings                                          |
| `src/components/store-report-export.tsx`               | Export job lifecycle and branded layout preview                           |
| `src/components/store-delete-dialog.tsx`               | Email challenge, cooldown/expiry and deletion confirmation                |
| `src/components/store-sales.tsx`, `src/lib/receipt.ts` | Sales/report presentation and receipt additions                           |
| `tests/pos-management.test.ts`                         | Permission, precision, recovery, version and download invariants          |

The client app must implement its own native storage/lifecycle and viewer/printing integration. The backend remains responsible for all authoritative permissions, deadlines, balances, stock, ledger/audit persistence, PDF generation and email-code enforcement.
