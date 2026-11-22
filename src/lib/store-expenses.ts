import { decimalAmount } from "./pos-management";

export const expenseCategories = [
  "RENT",
  "UTILITIES",
  "SALARIES",
  "SUPPLIES",
  "INVENTORY",
  "TRANSPORT",
  "MARKETING",
  "MAINTENANCE",
  "TAXES",
  "OTHER",
] as const;
export const expenseMethods = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CARD", "OTHER"] as const;
export type ExpenseDraft = {
  amount: number;
  currency: string;
  paidOn: string;
  category: (typeof expenseCategories)[number];
  description: string;
  payee?: string | null;
  method: (typeof expenseMethods)[number];
  reference?: string | null;
};
export type StoreExpense = ExpenseDraft & {
  id: string;
  storeId: number;
  version: number;
  status: "RECORDED" | "VOIDED";
  createdAt: string;
  updatedAt: string;
  recordedBy: string;
};
export type ExpenseAudit = {
  id: string;
  action: "CREATED" | "CORRECTED" | "VOIDED";
  reason?: string;
  actorName: string;
  createdAt: string;
  before?: StoreExpense;
  after: StoreExpense;
};
export function localExpenseDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function expenseInput(
  draft: Omit<ExpenseDraft, "amount"> & { amount: string },
): ExpenseDraft {
  const currency = draft.currency.trim().toUpperCase();
  if (
    !/^[A-Z]{3}$/.test(currency) ||
    !expenseCategories.includes(draft.category) ||
    !expenseMethods.includes(draft.method)
  )
    throw new Error("Check the expense details.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.paidOn) ||
    new Date(draft.paidOn + "T12:00:00Z").toISOString().slice(0, 10) !== draft.paidOn ||
    draft.paidOn > localExpenseDate()
  )
    throw new Error("Choose a valid payment date, today or earlier.");
  if (
    !draft.description.trim() ||
    draft.description.length > 500 ||
    (draft.payee?.length || 0) > 200 ||
    (draft.reference?.length || 0) > 128
  )
    throw new Error("Enter an expense description and check the field lengths.");
  const amount = decimalAmount(draft.amount, currency);
  if (amount >= 100_000_000_000) throw new Error("The expense amount is too large.");
  return {
    ...draft,
    amount,
    currency,
    description: draft.description.trim(),
    payee: draft.payee?.trim() || null,
    reference: draft.reference?.trim() || null,
  };
}
export function confirmedExpense(
  value: unknown,
  storeId: number,
  expected?: { id?: string; status?: string },
): StoreExpense {
  const e = value as StoreExpense;
  if (
    !e ||
    !/^[a-f0-9-]{36}$/i.test(e.id) ||
    e.storeId !== storeId ||
    !Number.isSafeInteger(e.version) ||
    e.version < 0 ||
    !Number.isFinite(e.amount) ||
    e.amount <= 0 ||
    !/^[A-Z]{3}$/.test(e.currency) ||
    !["RECORDED", "VOIDED"].includes(e.status) ||
    (expected?.id && expected.id !== e.id) ||
    (expected?.status && expected.status !== e.status)
  )
    throw new Error(
      "The expense could not be confirmed. Recover the saved request before recording another expense.",
    );
  return e;
}
