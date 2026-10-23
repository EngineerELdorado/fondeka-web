export type BillingMode = "ONE_TIME" | "MONTHLY" | "YEARLY";
export type PurchaseStatus = "PENDING" | "COMPLETED" | "FAILED" | "CANCELLED" | "REFUNDED";
export interface BusinessToolsAccess {
  accessGranted: boolean;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "REVOKED";
  validFrom: string | null;
  validUntil: string | null;
  plan: {
    code: string;
    name: string;
    billingMode: BillingMode;
    amount: number;
    currency: string;
    purchasesEnabled: boolean;
    version: number;
  };
  pendingPurchase: { id: string; status: "PENDING"; paymentTransactionId: number | null } | null;
  pricing: {
    planAmount: number;
    legacyCreditAmount: number;
    amountDue: number;
    currency: string;
  };
}
export interface BusinessToolsPurchase {
  id: string | null;
  status: PurchaseStatus;
  paymentTransactionId: number | null;
  accessGranted: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  access: BusinessToolsAccess;
}
export interface PaymentMethod {
  id: number;
  name: string;
  type: "BALANCE" | "MOBILE_MONEY" | "CRYPTO" | "BANK";
  typeLabel?: string;
  currency?: string | null;
  fiatWalletId?: number | null;
  balance?: number | null;
  walletEnabled?: boolean;
  localizedCollectionDisabledMessage?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  localizedBankInstructions?: string;
  bankInstructions?: string;
}
export interface PaymentMethods {
  paymentMethods: PaymentMethod[];
  ui?: { showCountrySelector?: boolean; allowAdditionalFiatWallets?: boolean };
}
export interface PaymentSelection {
  id: number;
  currency: string;
  feeApplicationMode: "EXCLUSIVE";
  fiatWalletId?: number;
  accountRef?: string;
  networkId?: number;
}
export interface PurchaseIntent {
  planCode: string;
  idempotencyKey: string;
  paymentMethod: PaymentSelection;
}
export interface AccessQuote {
  fees: number;
  feesCurrency: string;
  totalToPay: number;
  totalToPayCurrency: string;
  appliedFeeApplicationMode?: string;
}
export interface ReviewedQuote {
  value: AccessQuote;
  selection: string;
  planVersion: number;
  planCode: string;
  planAmount: number;
  planCurrency: string;
  pricing: BusinessToolsAccess["pricing"];
  receivedAt: number;
}
export interface PaymentTransaction {
  id: number;
  reference?: string;
  status?: string;
  paymentMethodId?: number;
  paymentMethodName?: string;
  currency?: string;
  grossAmount?: number;
  externalReference?: string;
  displayMessage?: string;
  receipt?: { humanMessage?: string };
  cryptoDetails?: {
    address?: string;
    cryptoCurrency?: string;
    network?: string;
    amountInCrypto?: number;
    exchangeRate?: number;
    invoiceUrl?: string;
    expiresAt?: string;
  } | null;
}
export const accessPath = "/customer-api/business-tools/access";
export const subscriptionsPath = "/customer-api/business-tools/subscriptions";
export const paymentClientVersion = "1.0.97";
export const purchaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const recoveryPrefix = "fondeka-business-tools:";
export const isPositiveId = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
export const isFiatCurrency = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z]{3}$/.test(value);

/** Only destinations owned by this portal; query parameters are reconstructed, never forwarded blindly. */
export function businessDestination(value: string): string | undefined {
  if (!value.startsWith("/") || value.startsWith("//")) return;
  let url: URL;
  try {
    url = new URL(value, "https://portal.invalid");
  } catch {
    return;
  }
  if (
    url.origin !== "https://portal.invalid" ||
    !/^\/(overview|developers|payment-requests|pos|stores(?:\/\d+)?)$/.test(url.pathname)
  )
    return;
  const query = new URLSearchParams();
  if (url.pathname === "/payment-requests" && url.searchParams.get("new") === "1")
    query.set("new", "1");
  if (url.pathname === "/pos" && /^\d+$/.test(url.searchParams.get("store") || ""))
    query.set("store", url.searchParams.get("store")!);
  return url.pathname + (query.size ? `?${query}` : "");
}
export function isOwnerApi(path: string) {
  return /^\/customer-api\/(commerce\/(stores|products)(?:[/?]|$)|payment_requests(?:[/?]|$)|businesses(?:[/?]|$))/.test(
    path,
  );
}
export function needsBusinessToolsRecovery(status: number, code: string | undefined, path: string) {
  return status === 403 && code === "BUSINESS_TOOLS_ACCESS_REQUIRED" && isOwnerApi(path);
}
export function accessDecision(access: BusinessToolsAccess) {
  if (access.accessGranted) return "granted";
  if (access.pendingPurchase) return "pending";
  if (!access.plan.purchasesEnabled) return "unavailable";
  // Partial store-payment credits are historical purchase snapshots, never a new top-up offer.
  if (
    access.plan.amount <= 0 ||
    access.pricing.amountDue <= 0 ||
    access.pricing.legacyCreditAmount > 0
  )
    return "review";
  return "purchase";
}
export function parseAccess(value: unknown): BusinessToolsAccess {
  const access = value as BusinessToolsAccess;
  if (
    !access ||
    typeof access.accessGranted !== "boolean" ||
    !access.plan ||
    typeof access.plan.code !== "string" ||
    !access.plan.code ||
    typeof access.plan.name !== "string" ||
    !["ONE_TIME", "MONTHLY", "YEARLY"].includes(access.plan.billingMode) ||
    !Number.isFinite(access.plan.amount) ||
    access.plan.amount < 0 ||
    !isFiatCurrency(access.plan.currency) ||
    typeof access.plan.purchasesEnabled !== "boolean" ||
    !Number.isInteger(access.plan.version) ||
    !access.pricing ||
    !Number.isFinite(access.pricing.planAmount) ||
    access.pricing.planAmount < 0 ||
    !Number.isFinite(access.pricing.legacyCreditAmount) ||
    access.pricing.legacyCreditAmount < 0 ||
    !Number.isFinite(access.pricing.amountDue) ||
    access.pricing.amountDue < 0 ||
    !isFiatCurrency(access.pricing.currency) ||
    (access.pendingPurchase &&
      (!purchaseIdPattern.test(access.pendingPurchase.id) ||
        access.pendingPurchase.status !== "PENDING" ||
        (access.pendingPurchase.paymentTransactionId !== null &&
          !isPositiveId(access.pendingPurchase.paymentTransactionId))))
  )
    throw new Error(
      "Fondeka returned an invalid Business Tools access response. Please retry or contact support.",
    );
  return access;
}
export function parsePurchase(value: unknown): BusinessToolsPurchase {
  const purchase = value as BusinessToolsPurchase;
  if (
    !purchase ||
    typeof purchase.accessGranted !== "boolean" ||
    !["PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED"].includes(purchase.status) ||
    (purchase.id !== null && !purchaseIdPattern.test(purchase.id)) ||
    (purchase.paymentTransactionId !== null && !isPositiveId(purchase.paymentTransactionId))
  )
    throw new Error(
      "Fondeka returned an invalid purchase response. Check your payment before trying again.",
    );
  parseAccess(purchase.access);
  return purchase;
}
export function normalizeMethods(response: unknown): PaymentMethods {
  const source = response as PaymentMethods;
  const methods: PaymentMethod[] = Array.isArray(response) ? response : source?.paymentMethods;
  if (!Array.isArray(methods))
    throw new Error("Payment methods could not be read. Please refresh.");
  return {
    paymentMethods: methods.filter(
      (method) =>
        method &&
        isPositiveId(method.id) &&
        ["BALANCE", "MOBILE_MONEY", "CRYPTO", "BANK"].includes(method.type),
    ),
    ui: Array.isArray(response) ? undefined : source.ui,
  };
}
export function methodKey(method: PaymentMethod) {
  return `${method.id}:${method.type}:${method.fiatWalletId ?? ""}:${method.currency ?? ""}`;
}
export function buildSelection(
  method: PaymentMethod,
  currency: string,
  phone = "",
  networkId?: number,
): PaymentSelection {
  if (!isPositiveId(method.id) || !isFiatCurrency(currency))
    throw new Error("Select an available method and fiat payment currency.");
  const selection: PaymentSelection = { id: method.id, currency, feeApplicationMode: "EXCLUSIVE" };
  if (method.type === "BALANCE") {
    if (
      !isPositiveId(method.fiatWalletId) ||
      method.walletEnabled === false ||
      currency !== method.currency
    )
      throw new Error("Select an eligible fiat wallet and its currency.");
    selection.fiatWalletId = method.fiatWalletId;
  } else if (method.type === "MOBILE_MONEY") {
    if (!phone.trim() || phone.trim().length > 254)
      throw new Error("Enter the payer’s mobile-money phone number.");
    selection.accountRef = phone.trim();
  } else if (method.type === "CRYPTO") {
    if (!isPositiveId(networkId)) throw new Error("Select a crypto network.");
    selection.networkId = networkId;
  } else if (method.type !== "BANK") throw new Error("This payment method is not supported.");
  if ((method.type === "MOBILE_MONEY" || method.type === "BANK") && currency !== method.currency)
    throw new Error("Use the payment method’s currency.");
  return selection;
}
export function quotePath(selection: PaymentSelection) {
  const query = new URLSearchParams({
    action: "BUSINESS_TOOLS_ACCESS",
    amount: "0",
    paymentMethodId: String(selection.id),
    currency: selection.currency,
    paymentCurrency: selection.currency,
    feeApplicationMode: "EXCLUSIVE",
  });
  if (selection.fiatWalletId) query.set("fiatWalletId", String(selection.fiatWalletId));
  return `/customer-api/fees?${query}`;
}
export function parseQuote(value: unknown): AccessQuote {
  const quote = value as AccessQuote;
  if (
    !quote ||
    !Number.isFinite(quote.totalToPay) ||
    quote.totalToPay <= 0 ||
    !Number.isFinite(quote.fees) ||
    quote.fees < 0 ||
    !isFiatCurrency(quote.totalToPayCurrency) ||
    !isFiatCurrency(quote.feesCurrency) ||
    (quote.appliedFeeApplicationMode && quote.appliedFeeApplicationMode !== "EXCLUSIVE")
  )
    throw new Error("A final payable quote is unavailable. Refresh the quote or contact support.");
  return quote;
}
export function validateReviewedQuote(
  quote: ReviewedQuote,
  selection: PaymentSelection,
  access: BusinessToolsAccess,
  now: number,
) {
  parseQuote(quote.value);
  if (
    quote.selection !== JSON.stringify(selection) ||
    quote.planCode !== access.plan.code ||
    quote.planVersion !== access.plan.version ||
    quote.planAmount !== access.plan.amount ||
    quote.planCurrency !== access.plan.currency ||
    quote.pricing.planAmount !== access.pricing.planAmount ||
    quote.pricing.legacyCreditAmount !== access.pricing.legacyCreditAmount ||
    quote.pricing.amountDue !== access.pricing.amountDue ||
    quote.pricing.currency !== access.pricing.currency ||
    now - quote.receivedAt > 60_000 ||
    now < quote.receivedAt
  )
    throw new Error("Refresh and review the final quote before confirming payment.");
}
export function canAfford(method: PaymentMethod, quote: AccessQuote) {
  return (
    method.type !== "BALANCE" ||
    (method.currency === quote.totalToPayCurrency &&
      typeof method.balance === "number" &&
      Number.isFinite(method.balance) &&
      method.balance >= quote.totalToPay)
  );
}
export function billingLabel(mode: BillingMode, language = "en") {
  const fr = language.startsWith("fr");
  return mode === "ONE_TIME"
    ? fr
      ? "Paiement unique"
      : "One-time payment"
    : mode === "MONTHLY"
      ? fr
        ? "Accès mensuel"
        : "Monthly access"
      : fr
        ? "Accès annuel"
        : "Yearly access";
}
