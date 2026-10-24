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
  logoUrl?: string | null;
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
    exchangeRateCurrency?: string;
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
    !/^\/(overview|business|settings|developers(?:\/(?:wallets|transactions|guides))?|payment-requests|pos|stores(?:\/\d+(?:\/pos)?)?)$/.test(
      url.pathname,
    )
  )
    return;
  if (url.pathname === "/settings") return "/settings";
  const query = new URLSearchParams();
  if (url.pathname === "/stores" && url.searchParams.get("mode") === "pos") {
    query.set("mode", "pos");
    if (url.searchParams.get("state") === "empty") query.set("state", "empty");
  }
  if (url.pathname === "/payment-requests" && url.searchParams.get("new") === "1")
    query.set("new", "1");
  if (url.pathname === "/pos" && /^\d+$/.test(url.searchParams.get("store") || ""))
    query.set("store", url.searchParams.get("store")!);
  if (url.pathname === "/pos" && /^\d{1,9}$/.test(url.searchParams.get("storePage") || ""))
    query.set("storePage", url.searchParams.get("storePage")!);
  if (url.pathname === "/payment-requests" && /^\d+$/.test(url.searchParams.get("request") || ""))
    query.set("request", url.searchParams.get("request")!);
  if (/^\/stores(?:\/\d+)?$/.test(url.pathname)) {
    const tab = url.searchParams.get("tab");
    if (tab && ["products", "sales", "customers", "reports", "staff", "settings"].includes(tab))
      query.set("tab", tab);
    for (const key of ["page", "product", "customer", "customerSalesPage"])
      if (/^\d+$/.test(url.searchParams.get(key) || "")) query.set(key, url.searchParams.get(key)!);
    const sale = url.searchParams.get("sale");
    if (sale && /^[A-Za-z0-9_-]{1,128}$/.test(sale)) query.set("sale", sale);
    if (url.pathname === "/stores" && url.searchParams.get("new") === "1") query.set("new", "1");
  }
  // Restore only known in-portal selections; no return URL is accepted.
  const copy = (key: string, pattern: RegExp) => {
    const value = url.searchParams.get(key);
    if (value && pattern.test(value)) query.set(key, value);
  };
  copy("flow", /^(store|product|request|customer|staff|api-key|sale)$/);
  copy(
    "step",
    /^(type|name|description|review|amount|settlement|details|items|cover|images|story|settings|price|media|stock|fulfillment|identity|note|permissions|webhook|payment|confirmation)$/,
  );
  if (/^\/stores\/\d+$/.test(url.pathname))
    for (const key of ["newProduct", "newCustomer", "invite"]) copy(key, /^1$/);
  if (url.pathname === "/developers") copy("createKey", /^1$/);
  if (/^\/developers(?:\/(?:wallets|transactions|guides))?$/.test(url.pathname))
    copy(
      "doc",
      /^(overview|quickstart|mobile-money-collection|mobile-money-payout|crypto-collection|crypto-payout|concepts|webhooks|testing|go-live|changelog)$/,
    );
  if ((url.pathname === "/developers/guides" || url.pathname === "/developers") && query.has("doc"))
    copy(
      "lesson",
      /^(map|setup|wallets|request|confirmation|refund|invoice|instructions|destination|reconcile|amounts|states|envelope|verify|scenarios|fund|convert|execute-conversion|history|prepare|release)$/,
    );
  if (/^\/developers(?:\/(?:wallets|transactions|guides))?$/.test(url.pathname)) {
    for (const key of ["business", "businessPage", "apiPage", "apiDetailBusiness"])
      copy(key, /^\d{1,12}$/);
    copy("guide", /^1$/);
    copy("environment", /^(LIVE|SANDBOX)$/);
    copy("apiReference", /^[A-Za-z0-9_-]{1,128}$/);
    copy("api_action", /^(BUSINESS_API_COLLECTION|BUSINESS_API_PAYOUT)$/);
    copy("api_status", /^[A-Z_]{1,64}$/);
    copy("api_currency", /^[A-Za-z]{3}$/);
    for (const key of ["api_reference", "api_clientReference"]) copy(key, /^[^\r\n]{1,128}$/);
    for (const key of ["api_fromDate", "api_toDate"]) copy(key, /^\d{4}-\d{2}-\d{2}$/);
  }
  if (url.pathname === "/payment-requests" || /^\/stores(?:\/\d+)?$/.test(url.pathname)) {
    copy("page", /^\d{1,12}$/);
    copy("search", /^[^\r\n]{1,128}$/);
    if (url.pathname === "/payment-requests") {
      copy("type", /^(QUICK_CHARGE|INVOICE|DONATION)$/);
      copy("status", /^(DRAFT|ACTIVE|SUSPENDED|COMPLETED|CANCELLED|EXPIRED)$/);
    } else {
      copy("period", /^(today|last_7_days|last_30_days|all|custom)$/);
      copy("currency", /^[A-Z]{3}$/);
      for (const key of ["from", "to"]) copy(key, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  return url.pathname + (query.size ? `?${query}` : "");
}
export function isOwnerApi(path: string) {
  return /^\/customer-api\/(commerce\/(stores|products|orders|customers)(?:[/?]|$)|payment_requests(?:[/?]|$)|businesses(?:[/?]|$))/.test(
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
export type PaymentContext = {
  action?: string;
  amount?: number;
  currency?: string;
  feeMode?: "INCLUSIVE" | "EXCLUSIVE";
  paymentRequestId?: number;
  paymentRequestCode?: string;
};
function requestIdentity(context: PaymentContext) {
  if (context.action !== "PAY_REQUEST") return {};
  if (!isPositiveId(context.paymentRequestId) && !context.paymentRequestCode?.trim())
    throw new Error("Select a payment request before collecting.");
  return {
    ...(isPositiveId(context.paymentRequestId)
      ? { paymentRequestId: String(context.paymentRequestId) }
      : {}),
    ...(context.paymentRequestCode ? { paymentRequestCode: context.paymentRequestCode } : {}),
  };
}
export function paymentMethodsPath(context: PaymentContext, country?: string) {
  return (
    "/customer-api/payment_methods?" +
    new URLSearchParams({
      type: "COLLECTION",
      action: context.action || "BUSINESS_TOOLS_ACCESS",
      ...(country ? { countryCode: country } : {}),
      ...requestIdentity(context),
    })
  );
}
export function collectionMethods(methods: PaymentMethod[], action: string) {
  return action === "COMMERCE_CHECKOUT_PAYMENT"
    ? methods.filter((method) => method.type !== "BALANCE")
    : methods;
}
export function quotePath(selection: PaymentSelection, context: PaymentContext = {}) {
  const query = new URLSearchParams({
    action: context.action || "BUSINESS_TOOLS_ACCESS",
    amount: String(context.amount ?? 0),
    paymentMethodId: String(selection.id),
    currency: context.currency || selection.currency,
    paymentCurrency: selection.currency,
    feeApplicationMode: context.feeMode || "EXCLUSIVE",
    ...requestIdentity(context),
  });
  if (selection.fiatWalletId) query.set("fiatWalletId", String(selection.fiatWalletId));
  if (selection.networkId) query.set("networkId", String(selection.networkId));
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
