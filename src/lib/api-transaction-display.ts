import type { ApiTransaction } from "./types";

export const apiTransactionActions = [
  "BUSINESS_API_COLLECTION",
  "BUSINESS_API_PAYOUT",
  "BUSINESS_API_BILL_PAYMENT",
] as const;

export function apiTransactionKind(action: string) {
  switch (action) {
    case "BUSINESS_API_COLLECTION":
      return "Collection";
    case "BUSINESS_API_PAYOUT":
      return "Payout";
    case "BUSINESS_API_BILL_PAYMENT":
      return "Bill payment";
    default:
      return "Other transaction";
  }
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
function scalar(value: unknown): string | undefined {
  return (
    text(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : undefined)
  );
}
export function apiTransactionContext(row: ApiTransaction) {
  const details = row.details;
  const tx = row.transaction;
  if (tx.action === "BUSINESS_API_BILL_PAYMENT") {
    const category = (
      { ELECTRICITY: "Electricity", WATER: "Water", TV: "Pay TV" } as Record<string, string>
    )[details?.billCategory || ""];
    return {
      title: text(details?.billProductName) || text(details?.billProductCode) || category,
      accountLabel: "Bill account",
      account: text(details?.accountNumber),
      operation: (
        { TV_RENEW: "Subscription renewal", TV_CHANGE: "Subscription change" } as Record<
          string,
          string
        >
      )[details?.operation || ""],
    };
  }
  if (tx.action !== "BUSINESS_API_COLLECTION" && tx.action !== "BUSINESS_API_PAYOUT")
    return { title: undefined, accountLabel: "Account", account: undefined, operation: undefined };
  const crypto = tx.cryptoDetails;
  const method =
    text(details?.paymentMethodDisplayName) ||
    text(details?.paymentMethodName) ||
    text(crypto?.cryptoCurrency);
  return {
    title: [method, text(crypto?.network)].filter(Boolean).join(" · ") || undefined,
    accountLabel: tx.action === "BUSINESS_API_PAYOUT" ? "Recipient" : "Payer",
    account:
      text(details?.accountRef) ||
      (tx.action === "BUSINESS_API_PAYOUT" ? text(crypto?.address) : undefined),
    operation: undefined,
  };
}

export type ApiReceiptField = {
  label: string;
  value: string;
  format?: "date" | "money";
  currency?: string;
  copyable?: boolean;
};

/** Display only named customer receipt fields; never dump provider payloads or infer success. */
export function apiReceiptFields(value: unknown): ApiReceiptField[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const receipt = value as Record<string, unknown>;
  const fields: ApiReceiptField[] = [];
  function add(label: string, value: unknown, extra: Partial<ApiReceiptField> = {}) {
    const safe = scalar(value);
    if (safe !== undefined) fields.push({ label, value: safe, ...extra });
  }
  add("Receipt number", receipt.receiptNumber);
  add("Provider reference", receipt.providerReference);
  if (Array.isArray(receipt.tokens))
    receipt.tokens
      .filter((token): token is string => !!text(token))
      .slice(0, 50)
      .forEach((token) => add("Token", token, { copyable: true }));
  add("Value received", receipt.valueReceived);
  add("Units", receipt.units);
  const subscription = receipt.newSubscription;
  if (subscription && typeof subscription === "object" && !Array.isArray(subscription)) {
    const item = subscription as Record<string, unknown>;
    add("Subscription number", item.subscriptionNumber);
    add("Package", item.name);
    add("Offer code", item.offerCode);
    if (typeof item.expiresAt === "string" && Number.isFinite(Date.parse(item.expiresAt)))
      add("Valid until", item.expiresAt, { format: "date" });
    if (
      typeof item.price === "number" &&
      Number.isFinite(item.price) &&
      item.price >= 0 &&
      typeof item.currency === "string" &&
      /^[A-Z]{3}$/.test(item.currency)
    )
      add("Package price", item.price, { format: "money", currency: item.currency });
    add("Receipt note", item.note);
  }
  return fields;
}
