import type { ApiEnvironment, ApiWallet, Page, SandboxWalletEntry } from "./types";

export function walletCurrency(value: string) {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Enter a three-letter fiat currency code.");
  return currency;
}
export function apiWalletsPath(businessId: number, environment: ApiEnvironment, currency = "") {
  const query = new URLSearchParams({ environment });
  if (currency) query.set("currency", walletCurrency(currency));
  return `/customer-api/businesses/${businessId}/api-wallets?${query}`;
}
export function sandboxEntriesPath(businessId: number, currency: string, page = 0) {
  return `/customer-api/businesses/${businessId}/sandbox-wallets/${walletCurrency(currency)}/entries?${new URLSearchParams({ page: String(page), size: "20" })}`;
}
export function sandboxTopUpPath(businessId: number) {
  return `/customer-api/businesses/${businessId}/sandbox-wallets/top-ups`;
}
const maxBalance = 999_999_999_999.99;
export const conversionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= maxBalance;
}
export function parseApiWallets(
  value: unknown,
  environment: ApiEnvironment,
  currency = "",
): ApiWallet[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (wallet) =>
        !wallet ||
        !/^[A-Z]{3}$/.test(wallet.currency) ||
        typeof wallet.balance !== "number" ||
        !Number.isFinite(wallet.balance) ||
        (environment === "SANDBOX" && (wallet.balance < 0 || wallet.balance > maxBalance)) ||
        wallet.environment !== environment ||
        (currency && wallet.currency !== currency),
    ) ||
    new Set(value.map((wallet) => wallet.currency)).size !== value.length
  ) {
    throw new Error(
      "Wallet balances could not be read for this environment. Refresh or contact support.",
    );
  }
  return value;
}
export function parseSandboxEntry(value: unknown, currency?: string): SandboxWalletEntry {
  const entry = value as SandboxWalletEntry;
  if (
    !entry ||
    typeof entry.id !== "string" ||
    !entry.id ||
    !/^[A-Z]{3}$/.test(entry.currency) ||
    (currency && entry.currency !== currency) ||
    entry.environment !== "SANDBOX" ||
    typeof entry.kind !== "string" ||
    !entry.kind ||
    !validMoney(entry.amount) ||
    !validMoney(entry.balanceAfter) ||
    entry.balanceAfter < 0 ||
    !Number.isSafeInteger(entry.sequence) ||
    entry.sequence < 1 ||
    !Number.isSafeInteger(entry.businessId) ||
    entry.businessId < 1 ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt)) ||
    (entry.conversionId != null && !conversionIdPattern.test(entry.conversionId)) ||
    (["CONVERSION_DEBIT", "CONVERSION_CREDIT"].includes(entry.kind) &&
      (!entry.conversionId ||
        entry.paymentReference !== null ||
        (entry.kind === "CONVERSION_DEBIT" ? entry.amount >= 0 : entry.amount <= 0))) ||
    (entry.paymentReference !== null &&
      (typeof entry.paymentReference !== "string" ||
        !/^SBX[A-Za-z0-9_-]+$/.test(entry.paymentReference)))
  )
    throw new Error("Sandbox wallet movement could not be read. Refresh or contact support.");
  return entry;
}
export function parseSandboxEntries(value: unknown, currency: string): Page<SandboxWalletEntry> {
  const page = value as Page<SandboxWalletEntry>;
  if (
    !page ||
    !Array.isArray(page.content) ||
    !Number.isSafeInteger(page.number) ||
    page.number < 0 ||
    !Number.isSafeInteger(page.size) ||
    page.size < 1 ||
    page.size > 100 ||
    !Number.isSafeInteger(page.totalElements) ||
    page.totalElements < 0 ||
    !Number.isSafeInteger(page.totalPages) ||
    page.totalPages < 0
  ) {
    throw new Error("Sandbox wallet history could not be read. Refresh or contact support.");
  }
  page.content.forEach((entry) => parseSandboxEntry(entry, currency));
  return page;
}
export function sandboxAmount(amount: string) {
  const normalized = amount.trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized))
    throw new Error("Enter an amount with at most two decimal places.");
  const value = Number(normalized);
  if (value < 0.01 || value > 1_000_000)
    throw new Error("Enter an amount between 0.01 and 1,000,000 units.");
  return value;
}
export function sandboxFundingBody(currency: string, amount: string) {
  return { currency: walletCurrency(currency), amount: sandboxAmount(amount) };
}
