import type { Order, Quote, Store } from "./types";
import { canUseStore } from "./commerce";

/** Optional rollout contract. Absent flags never authorize a write on an older server. */
export interface PosFeatures {
  discounts?: boolean;
  installments?: boolean;
  corrections?: boolean;
  correctionPolicy?: boolean;
  reportExports?: boolean;
  emailDeletion?: boolean;
}
export interface CorrectionPolicy {
  version: number;
  staffWindowHours: number;
  ownerWindowHours: number;
}
export interface PosDiscount {
  type: "FIXED" | "PERCENTAGE";
  value: number;
  currency?: string;
  reason: string;
}
export interface PosPaymentEntry {
  id: string;
  amount: number;
  currency: string;
  method: "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER";
  receivedAt: string;
  recordedAt: string;
  recordedBy: string;
  reference?: string;
  note?: string;
}
export interface PosAuditEntry {
  id: string;
  type: "CREATED" | "CORRECTED" | "VOIDED" | "PAYMENT_RECORDED";
  createdAt: string;
  actorName: string;
  reason?: string;
  summary: string;
}
export interface PosActions {
  canRecordPayment: boolean;
  canCorrect: boolean;
  canVoid: boolean;
  correctionAllowedUntil?: string;
}
export interface CorrectionQuote extends Quote {
  quoteId: string;
  orderVersion: number;
  amountPaid: number;
  balanceDue: number;
  refundRequiredAmount: number;
}
export interface SalesExport {
  id: string;
  storeId: number;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  createdAt: string;
  expiresAt?: string;
  downloadUrl?: string;
  errorMessage?: string;
  fromDate: string;
  toDate: string;
  currency: string;
  language: "en" | "fr";
}
export interface DeletionChallenge {
  challengeId: string;
  storeId: number;
  maskedEmail: string;
  expiresAt: string;
  resendAfter: string;
}

export function hasPosFeature(store: Store, feature: keyof PosFeatures) {
  return store.posFeatures?.[feature] === true;
}
export function saleBalance(order: Order) {
  const amount = order.balanceDue ?? order.outstandingAmount;
  const currency = order.balanceDueCurrency || order.outstandingCurrency || order.totalCurrency;
  return { amount, currency };
}
export function saleActionAllowed(
  store: Store,
  order: Order,
  action: "payment" | "correct" | "void",
  now = Date.now(),
) {
  if (
    order.storeId !== store.id ||
    order.channel !== "POS" ||
    !canUseStore(store, "POS") ||
    !Number.isSafeInteger(order.version) ||
    order.version! < 0 ||
    ["VOIDED", "CANCELLED", "DELETED"].includes(order.status)
  )
    return false;
  if (action === "payment") {
    const balance = saleBalance(order);
    return (
      hasPosFeature(store, "installments") &&
      order.posActions?.canRecordPayment === true &&
      order.posPaymentMode === "CASH" &&
      Number.isFinite(balance.amount) &&
      balance.amount! > 0
    );
  }
  return (
    hasPosFeature(store, "corrections") &&
    order.posPaymentMode === "CASH" &&
    order.posActions?.[action === "correct" ? "canCorrect" : "canVoid"] === true &&
    Date.parse(order.posActions.correctionAllowedUntil || "") > now
  );
}
export function saleActionUnavailableReason(
  store: Store,
  order: Order,
  action: "payment" | "correct" | "void",
  now = Date.now(),
) {
  if (saleActionAllowed(store, order, action, now)) return undefined;
  if (!canUseStore(store, "POS")) return "permission";
  if (["VOIDED", "CANCELLED", "CANCELED", "DELETED"].includes(order.status)) return "voided";
  if (order.posPaymentMode !== "CASH") return "provider";
  if (!hasPosFeature(store, action === "payment" ? "installments" : "corrections"))
    return "feature";
  if (order.storeId !== store.id || !Number.isSafeInteger(order.version) || order.version! < 0)
    return "refresh";
  if (action === "payment") return saleBalance(order).amount === 0 ? "paid" : "unavailable";
  const deadline = Date.parse(order.posActions?.correctionAllowedUntil || "");
  if (Number.isFinite(deadline) && deadline <= now) return "window";
  if (!Number.isFinite(deadline) || !order.posActions) return "refresh";
  return "unavailable";
}
export function decimalAmount(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const normalized = value.trim().replace(",", ".");
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1, digits)}})?$`).test(normalized) ||
    (digits === 0 && normalized.includes("."))
  )
    throw new Error("Enter a valid amount in this currency.");
  const amount = Number(normalized);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(Math.round(amount * 10 ** digits))
  )
    throw new Error("Enter a valid positive amount.");
  return amount;
}
export function discountInput(
  type: PosDiscount["type"],
  value: string,
  reason: string,
  currency: string,
): PosDiscount {
  if (!["FIXED", "PERCENTAGE"].includes(type)) throw new Error("Choose a discount type.");
  const amount = decimalAmount(value, type === "PERCENTAGE" ? "USD" : currency);
  if (type === "PERCENTAGE" && amount >= 100)
    throw new Error("The discount must be less than 100%.");
  if (!reason.trim() || reason.trim().length > 500)
    throw new Error("Enter a discount reason (up to 500 characters).");
  return { type, value: amount, reason: reason.trim(), ...(type === "FIXED" ? { currency } : {}) };
}
export function assertDiscountQuote(discount: PosDiscount | undefined, quote: Quote) {
  if (!discount) return;
  if (
    !quote.discount ||
    quote.discount.type !== discount.type ||
    quote.discount.value !== discount.value ||
    quote.discount.reason !== discount.reason ||
    quote.discount.currency !== discount.currency ||
    !Number.isFinite(quote.discountAmount) ||
    quote.discountAmount! <= 0
  )
    throw new Error("The discount was not confirmed. Recalculate the sale before continuing.");
}
export function correctionPolicyInput(
  staff: string,
  owner: string,
  version: number,
): CorrectionPolicy {
  if (!/^\d+$/.test(staff) || !/^\d+$/.test(owner) || !Number.isSafeInteger(version) || version < 0)
    throw new Error("Enter correction windows in whole hours.");
  const staffWindowHours = Number(staff),
    ownerWindowHours = Number(owner);
  if (
    ![staffWindowHours, ownerWindowHours].every(
      (v) => Number.isSafeInteger(v) && v >= 0 && v <= 8760,
    ) ||
    ownerWindowHours < staffWindowHours
  )
    throw new Error("Use 0–8760 hours; the owner window must cover the staff window.");
  return { version, staffWindowHours, ownerWindowHours };
}
export function confirmedOrder(
  value: unknown,
  storeId: number,
  reference: string,
  expectedVersion?: number,
): Order {
  const order = value as Order;
  if (
    !order ||
    order.storeId !== storeId ||
    order.reference !== reference ||
    order.channel !== "POS" ||
    !Number.isSafeInteger(order.version) ||
    !Number.isFinite(order.totalAmount) ||
    (expectedVersion !== undefined && order.version! <= expectedVersion)
  )
    throw new Error("The sale update could not be verified. Retry the same request.");
  return order;
}
export function confirmedExport(
  value: unknown,
  storeId: number,
  expected?: { id?: string; from?: string; to?: string; currency?: string; language?: string },
): SalesExport {
  const job = value as SalesExport;
  if (
    !job ||
    job.storeId !== storeId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(job.id) ||
    !["QUEUED", "PROCESSING", "COMPLETED", "FAILED", "EXPIRED"].includes(job.status) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(job.fromDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(job.toDate) ||
    !/^[A-Z]{3}$/.test(job.currency) ||
    !["en", "fr"].includes(job.language) ||
    !Number.isFinite(Date.parse(job.createdAt)) ||
    (expected?.id !== undefined && job.id !== expected.id) ||
    (expected?.from !== undefined && job.fromDate !== expected.from) ||
    (expected?.to !== undefined && job.toDate !== expected.to) ||
    (expected?.currency !== undefined && job.currency !== expected.currency) ||
    (expected?.language !== undefined && job.language !== expected.language)
  )
    throw new Error("The report job could not be verified. Retry the same request.");
  return job;
}
export function pdfDownloadUrl(job: SalesExport, now = Date.now()) {
  if (
    job.status !== "COMPLETED" ||
    !job.expiresAt ||
    !Number.isFinite(Date.parse(job.expiresAt)) ||
    Date.parse(job.expiresAt) <= now
  )
    return undefined;
  try {
    const url = new URL(job.downloadUrl || "");
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch {
    /* A finished job without a valid download remains unavailable. */
  }
}
