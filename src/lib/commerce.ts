import type { Store, PosInput, PayerField } from "./types";
export function normalizePayerFields(fields: PayerField[]) {
  const seen = new Set<string>();
  return fields.map((field) => {
    const key = (field.key || field.label)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/^_+/, "");
    const label = field.label.trim();
    if (!key || !label || seen.has(key)) throw new Error("Give each payer field a unique name.");
    seen.add(key);
    return { key, label, required: field.required === true };
  });
}
export const staffPermissions = ["POS", "REPORTS", "PRODUCTS", "SALES", "CUSTOMERS"] as const;
export function isStoreOwner(store: Store) {
  return store.accessType === "OWNER";
}
export function canUseStore(store: Store, permission: string) {
  return (
    isStoreOwner(store) ||
    (store.accessType === "STAFF" &&
      !!store.staffPermissions?.some((value) => value.toUpperCase() === permission.toUpperCase()))
  );
}
export function storeTabAllowed(store: Store, tab: string) {
  return ["staff", "settings"].includes(tab)
    ? isStoreOwner(store)
    : canUseStore(
        store,
        { products: "PRODUCTS", sales: "SALES", customers: "CUSTOMERS", reports: "REPORTS" }[tab] ||
          "",
      );
}
export function validateCashSale(input: PosInput, total: number) {
  if (!Number.isFinite(total) || total <= 0)
    throw new Error("Calculate the sale before confirming.");
  if (input.paymentStatus !== "PAID") {
    if (!input.customerId && !input.buyerName?.trim())
      throw new Error("Select or create a customer for an unpaid sale.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDueDate || "") ||
      Date.parse(input.paymentDueDate! + "T23:59:59") < Date.now()
    )
      throw new Error("Choose a valid future payment due date.");
  }
  if (
    input.paymentStatus === "PARTIALLY_PAID" &&
    (!Number.isFinite(input.amountPaid) || input.amountPaid! <= 0 || input.amountPaid! >= total)
  )
    throw new Error("The amount received must be greater than zero and less than the total.");
}
export function reportQuery(period: string, currency: string, from?: string, to?: string) {
  if (period === "custom" && (!from || !to || from > to))
    throw new Error("Choose a valid date range.");
  return new URLSearchParams({
    ...(currency ? { currency } : {}),
    ...(period === "custom" ? { from: from!, to: to! } : { period }),
  }).toString();
}

/** The backend store PATCH applies full settings, so preserve fields when publishing. */
export function storeUpdateInput(store: Store, patch: Partial<import("./types").StoreInput> = {}) {
  const keys = [
    "name",
    "slug",
    "description",
    "defaultCurrency",
    "countryCode",
    "reportCurrency",
    "logoUrl",
    "bannerUrl",
    "videoUrl",
    "videoDurationSeconds",
    "whatsappNumber",
    "contactEmail",
    "facebookUrl",
    "instagramUrl",
    "youtubeUrl",
    "linkedinUrl",
    "twitterUrl",
    "tiktokUrl",
    "status",
    "visibility",
  ] as const;
  return { ...Object.fromEntries(keys.map((key) => [key, store[key] ?? null])), ...patch };
}
/** Preserve concurrent server changes to settings the customer did not edit. */
export function storeEditInput(
  original: Store,
  current: Store,
  draft: import("./types").StoreInput,
) {
  const baseline = storeUpdateInput(original);
  const changes = Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) =>
        key in baseline && (value ?? "") !== (baseline[key as keyof typeof baseline] ?? ""),
    ),
  );
  return storeUpdateInput(current, changes);
}
