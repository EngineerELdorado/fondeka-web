# Store expenses: web, client and backend

Implemented on 2026-11-21 in the web, Expo client and backend projects.

## User flow and access

The web store has an **Expenses** tab. In the client app, open the store menu and choose **Expenses**. Owners have access automatically. Owners can grant staff the separate `EXPENSES` permission; `POS`, `SALES` and `REPORTS` alone do not grant expense management. The backend advertises `capabilities.canManageExpenses`. No separate rollout flag needs enabling.

Record an **already-paid business outflow**: description, amount, ISO fiat currency, payment date, category, payment method, and optional payee/reference. Recording does not send money or debit a Fondeka wallet. Positive amounts only, with the currency's minor-unit precision. The payment date is a calendar date, independent of the phone's timestamp.

Categories: `RENT`, `UTILITIES`, `SALARIES`, `SUPPLIES`, `INVENTORY`, `TRANSPORT`, `MARKETING`, `MAINTENANCE`, `TAXES`, `OTHER`. Methods: `CASH`, `BANK_TRANSFER`, `MOBILE_MONEY`, `CARD`, `OTHER`.

Correct an entry with a reason and its current version. Cancel a mistaken/duplicate entry with a reason. Cancellation removes it from expense totals and retains its original and subsequent history; it does not refund money. Cancelled entries are read-only and can be included in the register filter.

## API

Authenticated customer/device session, scoped to `/customer-api/commerce/stores/{storeId}`. All writes require `Idempotency-Key`; preserve the exact key and serialized payload after timeouts. The clients save pending commands by account/store/operation and recover them before creating a replacement.

| Method | Path                           | Input / result                                                                                                    |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/expenses`                    | Optional `from`, `to` (inclusive `YYYY-MM-DD`), `category`, `includeVoided=false`, `page=0`, `size=20` (max 100). |
| POST   | `/expenses`                    | Expense draft below; returns saved expense.                                                                       |
| POST   | `/expenses/{uuid}/corrections` | `{expense: <draft>, expectedVersion, reason}`; returns new version.                                               |
| POST   | `/expenses/{uuid}/voids`       | `{expectedVersion, reason}`; returns status `VOIDED`.                                                             |
| GET    | `/expenses/{uuid}/history`     | `page`, `size`; paginated actor, timestamp, reason, before/after snapshots.                                       |

```json
{
  "amount": 125,
  "currency": "USD",
  "paidOn": "2026-11-21",
  "category": "RENT",
  "description": "November store rent",
  "payee": "Landlord",
  "method": "BANK_TRANSFER",
  "reference": "RENT-NOV-26"
}
```

The resource adds `id`, `storeId`, `version`, `status` (`RECORDED` / `VOIDED`), `createdAt`, `updatedAt` and `recordedBy`. Success responses are HTTP 200 and `Cache-Control: no-store`. A write replay returns its original response snapshot even if the expense has subsequently changed. A stale version or a mutation of a cancelled entry returns HTTP 409 `EXPENSE_VERSION_CONFLICT`. Refresh before correcting a definitively rejected first attempt. Changed content under the same idempotency key returns `IDEMPOTENCY_CONFLICT`; retain unresolved commands.

Pagination uses `{content, page:{number,size,totalElements,totalPages}}`. Register responses also contain `totals:[{currency,amount,count}]`, across **all matching active entries**, independent of the displayed page. Do not add different currencies together in the register. Existing web pagination normalization adds flat pagination fields.

Descriptions/payees/references are literal text. Clients must not interpret them as HTML or executable links. Never manufacture zero expense totals when connecting to an older backend that omits the report fields.

## Reports and business performance

`GET /reports/sales` and `/reports/pos` add:

- `expensesAmount` and `expenseCount`;
- `expensesByCategory:[{category,amount,count}]`;
- `salesAfterExpensesAmount = merchantProceedsAmount - expensesAmount`;
- `receiptsAfterExpensesAmount = paymentsReceivedAmount - expensesAmount`.

Expenses belong to the period of **paidOn**, and cancelled entries are excluded. Store expenses apply to the whole store, including in the POS view; they are not assigned to individual sales channels. Sales totals still follow sale creation dates, while receipts follow payment dates and include installments on older sales. Therefore these two performance measures intentionally differ. Negative results are valid.

Amounts are converted to the selected report currency using the existing preview FX service. Expense calculations multiply by one rate per source currency before rounding the total to the target minor units. Expense currencies are included among report currency choices. Missing conversion rates must produce an error, never a partial total. Category rounding can cause a minor-unit difference from the independently rounded overall total.

The async `/reports/sales/exports` PDF job captures expense rows and expense audit events in the same bounded, repeatable-read snapshot as sales/payments. It persists its FX basis before rendering. PDFs include expense totals, performance measures, category breakdown, the detailed register (original and report currencies), and corrections/cancellations. Existing PDFs retain their original snapshots; request a new export to include newly recorded expenses.

These measures describe **recorded activity**, not accounting profit or wallet balances. There is no automatic inventory cost-of-goods, depreciation, payroll accrual, owner funding/draw or bank reconciliation engine. Do not enter provider fees/refunds a second time if already deducted from sales proceeds. Receipt-based performance is gross receipts minus recorded expenses; it is not a fee/refund-adjusted bank balance.

## Implementation and deployment

Backend migration: `20270139_store_expenses.sql` creates the register and audit tables. Existing POS operation persistence supplies durable idempotency. Store locks serialize writes and refresh staff authorization before accepting a command. No expense provider calls or payment webhook is generated.

Web: `src/components/store-expenses.tsx`, `src/lib/store-expenses.ts`; exact proxy routes forward idempotency on expense writes. The register uses a table with date, description, amount, payment method, status and audited actions. The report shows server-supplied expense performance. **Report PDF**, beside **Refresh**, opens a compact export dialog. Report queries use the browser's local timezone so calendar-day expenses appear in the selected local period.

Client: `StoreDetailScreen` menu/report integration, `components/StoreExpenses.js`, `commerceExpensesApi.js`, `commerceExpenses.js`, and extensions to the existing secure durable POS command layer. EN/FR copy is provided. This is JavaScript-only; it adds no native dependency.

Validation covers real PostgreSQL migration/persistence/retries/versioning/permissions/audit, sale-versus-receipt math, PDF rendering in EN/FR, web regression tests, synthetic browser flows including lost-response recovery after reload, and native component/command tests. Browser tests do not write actual store expenses.
