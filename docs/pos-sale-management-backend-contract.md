# POS sale management integration

Current implementation and rollout configuration: [backend POS integration guide](../../../backend/docs/commerce-pos-sale-management.md). Sale management support defaults to disabled; clients require server feature flags and per-sale action grants.

This is the proposed backend contract used by the web frontend. These endpoints are **not implemented by this frontend change**. The existing backend currently exposes POS creation/quotes, scoped order reads and JSON sales reports. Enable each feature only after its server implementation is deployed. No real payments, emails or report jobs are simulated in the production frontend.

## Rollout and authorization

Add optional fields to authenticated Store resources (owned and shared stores):

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

Missing flags mean unavailable. Existing sales without a discount continue using the current API. New controls require explicit feature support. The frontend shows an unavailable state rather than sending unsupported operations or falling back to unsafe edits. Feature flags describe support, and never replace authorization.

Add these fields to POS order resources, including sale-list rows and `GET /customer-api/commerce/stores/{id}/pos/orders/{reference}`:

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
  "auditTrail": []
}
```

The server calculates these permissions for the authenticated viewer, store, payment mode and order. Check them again atomically on every write. The frontend supports manual installments/corrections/voids for CASH POS sales. Existing FONDEKA collection/refund flows remain separate. Staff require POS permission; viewing SALES alone does not grant mutation rights. Online orders are excluded.

Correction deadlines start at the immutable sale creation instant. Apply the current owner's policy consistently on reads and writes, including changes that shorten an existing window. The backend owns the clock and denies expired writes. Later payments on an outstanding balance are independent of correction windows. Voided sales cannot receive further changes/payments.

## Idempotency, versions and audit

Payment, correction, void and export creation POSTs require `Idempotency-Key`. Scope keys to account/store/operation and order where applicable. Normalize content before hashing. Persist the result and operation identity durably. Replays return the **same operation result**, even after the order version/deadline subsequently changes. A key used with different content returns `409 IDEMPOTENCY_CONFLICT`. Check an existing idempotent result before new-operation version/window checks, after authentication and ownership checks.

Order mutations include `expectedVersion`. Lock the order and atomically check version, permission, balance, inventory and policy; update projections, append history and increment version once. A definitively rejected stale new write returns `409 SALE_VERSION_CONFLICT` without side effects. Timeouts and 5xx must never require a new key.

The frontend saves the exact intent before sending. Recovery survives reload in browser session storage, scoped to the signed-in account and exact endpoint. Inputs are frozen while an outcome is unresolved. Other mutations for that sale are blocked until recovery. A successful response must identify the same store/order and include a numeric version before the frontend clears recovery. Logout/account switching clears this data. OTPs and signed download links are not persisted.

Never overwrite aggregate `amountPaid` as a user edit. Retain immutable payment entries and correction snapshots, actor ID/name, server timestamp, reason, request ID and operation ID. History should be paginated server-side if necessary before the arrays become unbounded; introduce an explicit supported history contract for that rollout.

## Later payments

`POST /customer-api/commerce/stores/{id}/pos/orders/{reference}/payments`

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

Supported manual methods: `CASH`, `BANK_TRANSFER`, `MOBILE_MONEY`, `OTHER`. These record money already received outside Fondeka; they do not initiate a provider charge or credit a Fondeka wallet. An external method requires a reference. Validate currency precision, positive amount, no overpayment, currency compatibility, and receipt time between sale creation and now. `recordedAt` is always server time and must stay separate from the supplied `receivedAt`.

Return the complete updated Order with authoritative totals/status/version, `payments` and `auditTrail`. Payment entries have `id`, `amount`, `currency`, `method`, `receivedAt`, `recordedAt`, `recordedBy`, optional `reference` and `note`. Derive PAID/PARTIALLY_PAID/ON_CREDIT from the ledger. Legacy initial payments need an explicit initial entry or a clearly identified opening-balance entry; do not double count them.

## Discounts at checkout

The current POS order/quote request gains optional `discount`:

```json
{ "type": "PERCENTAGE", "value": 10, "reason": "Customer negotiation" }
```

Or `{"type":"FIXED","value":10,"currency":"USD","reason":"Customer negotiation"}`. A fixed amount is denominated in the request's billing currency. Percentages are greater than 0 and less than 100; fixed discounts must leave a positive eligible subtotal. Validate permission, eligibility and currency precision server-side. Preserve original unit prices and discounted totals separately. Discounts reduce merchandise value before the current fee/FX calculation; do not treat a discount as a receipt, payment or fee. Proportionally allocate sale-level discounts to eligible lines with deterministic minor-unit rounding for product reports and later corrections.

Quote responses must echo the accepted `discount` and return `subtotalBeforeDiscountAmount`, `discountAmount` and `discountCurrency` alongside existing final totals. The frontend rejects a quote that silently ignores its discount. Include the same snapshot in created orders, receipts, ledger/report projections and external payment quotes (`/pos/payments/quote`). Recheck the normalized discount during creation; do not silently accept a different adjustment.

## Corrections and sale deletion

`POST .../pos/orders/{reference}/corrections/quote` accepts:

```json
{
  "expectedVersion": 4,
  "items": [{ "productId": 11, "quantity": 2 }],
  "buyerName": "Maya Customer",
  "paymentDueDate": "2026-12-31",
  "discount": { "type": "PERCENTAGE", "value": 10, "reason": "Customer negotiation" },
  "reason": "Missed second item at checkout"
}
```

`discount: null` removes an existing discount. The web sends the retained line set; removed lines are omitted. Reuse captured unit-price/fee/FX snapshots under a defined correction policy, and never silently reprice historical lines from today's catalog. Validate stock changes without applying them during preview. Retain immutable customer identity; `buyerName` only corrects the sale's display snapshot. Validate due dates for outstanding credit.

Return `quoteId`, `orderVersion`, `expiresAt` and the existing Quote fields plus `amountPaid`, `balanceDue`, `refundRequiredAmount`. All three amount fields are in `totalCurrency`. Totals must be finite and nonnegative; `totalAmount` is positive. A quote reserves nothing. The web blocks saving if a refund is needed; a future explicit refund workflow can be added separately.

`POST .../pos/orders/{reference}/corrections` sends the same body plus `quoteId`, with an idempotency header. Bind quotes to store/order/version/request hash/expiry; revalidate atomically on apply. Return a full updated Order. Paid money remains unchanged by a correction. Increment version and append before/after evidence, inventory deltas and actor/reason. Never mutate product catalog prices from this workflow.

`POST .../pos/orders/{reference}/voids` sends `expectedVersion`, required `reason` and `inventoryDisposition` (`RESTOCK` or `DO_NOT_RESTOCK`). This is the UI's “Delete sale” action. It marks a sale VOIDED while retaining its original lines, payments, audit and references. Apply authorized stock adjustments once. No automatic provider refund or wallet movement is implied. Exclude voided sale revenue/receivables from active sales totals; retain cash receipt/refund evidence and show void totals separately. Define the financial treatment of already collected money explicitly in reports. Return a full updated Order and deny further updates.

Audit entries returned in `auditTrail`: `id`, `type` (`CREATED`, `CORRECTED`, `VOIDED`, `PAYMENT_RECORDED`), `createdAt`, `actorName`, optional `reason`, and a human-readable `summary`. The backend must retain structured before/after evidence beyond that summary.

## Owner correction-window settings

`PATCH /customer-api/commerce/stores/{id}/pos/correction-policy`

Body and response use `{version, staffWindowHours, ownerWindowHours}`. Only the owner with store-management rights can change this policy. Use optimistic concurrency; return the incremented version. The frontend currently accepts whole hours 0–8760, with owner hours at least staff hours. Zero disables corrections for that role. Suggested initial values are 24 / 168 hours; do not claim they are configured until the server returns them. Keep the settings in Store responses, and audit policy changes.

## Asynchronous PDF exports

`POST /customer-api/commerce/stores/{id}/reports/sales/exports` returns 202 with a durable job. Body:

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

Use REPORTS permission and store-scoped authorization. Capture a consistent, immutable snapshot of the complete filtered dataset in a durable background job, then return promptly. Do not render the PDF inside the HTTP request. Job reads and signed links must preserve the requested language, currency, period and reporting timezone. Revalidate permission before returning a download. Define date boundaries consistently with the existing JSON report; validate dates/timezone and bound resource use.

`GET .../reports/sales/exports/{jobId}` returns:

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

Statuses: QUEUED, PROCESSING, COMPLETED, FAILED, EXPIRED. Failed jobs may include a safe `errorMessage`. The frontend polls with increasing intervals, stops after 12 reads or an error, and offers an explicit progress check. It retains the job ID in account/store-scoped session storage, so leaving/reloading does not start a second export. Completed links must be absolute HTTPS URLs with explicit expiry, correct PDF content type and a descriptive filename. The PDF viewer provides printing and saving. Generate fresh signed links on authorized reads when appropriate.

The web's `ReportExportPanel` and `.report-paper` CSS provide the reviewed visual direction: white A4 page, navy masthead, store logo/contact details on the left, report title/period/currency on the right, three summary cards, readable tables and restrained footer. The live preview uses current JSON values and is labeled as a layout preview; it never claims to be a finished PDF. Port this presentation into the backend renderer, with:

- Store name, owned logo asset, contact details, period, timezone, currency, generation time and unique report/job reference.
- Summary: gross merchandise value, discounts, recognized sales, collected amount, balance due, proceeds, order counts, void counts/amounts, and taxes/fees only when actual accounting fields exist.
- Full sales table: reference, sale date, customer, staff, original subtotal, discount, final total, cumulative paid, outstanding balance, due date and status.
- Separate payment-ledger section: receipt and recording dates, sale reference, customer, method, reference, amount/currency and recorder. Distinguish cash received **during the period** from cumulative payments attached to sales **created during the period**. A payment on an older credit sale belongs in its receipt-period totals.
- Correction/void appendix: original/current versions, actor, timestamp, reason, inventory disposition and monetary deltas. Retain visibility of voided-sale cash needing reconciliation; never imply a refund happened without a refund entry.
- Top products and receivables; all filtered rows, independent of the web's pagination.
- Embedded fonts, repeating table headers, page numbers, no clipped rows, sensible page breaks and no mixed-currency summation without an explicit captured FX basis. Escape all merchant/customer text. Load logos only from controlled store assets; the renderer must not fetch arbitrary user URLs.

Optional JSON report fields now displayed by the web: `discountAmount`, `voidedOrderCount`, `voidedSalesAmount`, `paymentsReceivedAmount`, `paymentsReceivedCurrency`. Missing values remain absent, not invented zeros.

## Email-verified store deletion

`POST /customer-api/commerce/stores/{id}/deletion-challenges` with `{}` sends a short-lived six-digit OTP to the owner's verified account email, never an arbitrary contact address. Return `{challengeId, storeId, maskedEmail, expiresAt, resendAfter}` with ISO timestamps. Require owner authorization, rate-limit sends/attempts, hash stored codes, and invalidate prior codes on resend. Bind the challenge to owner/store/action.

`POST .../deletion-confirmations` with `{challengeId, code}` verifies the code and deletes atomically. Return `{storeId, deleted:true}`. Make retries of an already successful same-owner challenge safe, including after a lost response. Expired, invalid, exhausted and wrong-store challenges must fail without deleting. Do not log the code. The frontend keeps codes only in memory, handles expiry/resend cooldowns, and requires explicit deletion acknowledgement.

The web proxy no longer allows the old unverified `DELETE /stores/{id}`. The backend must also close or enforce OTP on that old endpoint; frontend controls cannot secure a directly accessible backend route. Until email deletion support is advertised, the frontend provides a support message and never falls back to unverified deletion.
