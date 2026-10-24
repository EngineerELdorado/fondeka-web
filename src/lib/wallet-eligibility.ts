import {
  buildSelection,
  canAfford,
  isFiatCurrency,
  isPositiveId,
  methodKey,
  parseQuote,
  quotePath,
  type PaymentContext,
  type PaymentMethod,
} from "./business-tools";

export type WalletEligibility = {
  key: string;
  status: "eligible" | "insufficient" | "unavailable" | "ineligible";
};

/** Read-only, bounded fee quotes. Never compare different currencies or assume zero fees. */
export async function checkWalletEligibility(
  methods: PaymentMethod[],
  context: PaymentContext,
  read: (path: string, signal: AbortSignal) => Promise<unknown>,
  signal: AbortSignal,
): Promise<WalletEligibility[]> {
  const wallets = methods.filter((method) => method.type === "BALANCE");
  const results: WalletEligibility[] = new Array(wallets.length);
  let next = 0;
  async function worker() {
    while (next < wallets.length) {
      if (signal.aborted) throw new DOMException("Wallet check cancelled", "AbortError");
      const index = next++;
      const method = wallets[index];
      const key = methodKey(method);
      if (
        !isPositiveId(method.fiatWalletId) ||
        method.walletEnabled === false ||
        !isFiatCurrency(method.currency || "")
      ) {
        results[index] = { key, status: "ineligible" };
        continue;
      }
      if (typeof method.balance !== "number" || !Number.isFinite(method.balance)) {
        results[index] = { key, status: "unavailable" };
        continue;
      }
      if (method.balance <= 0) {
        results[index] = { key, status: "insufficient" };
        continue;
      }
      try {
        const selection = buildSelection(method, method.currency!);
        const quote = parseQuote(await read(quotePath(selection, context), signal));
        if (signal.aborted) throw new DOMException("Wallet check cancelled", "AbortError");
        if (quote.totalToPayCurrency !== selection.currency)
          throw new Error("Quote currency mismatch");
        results[index] = { key, status: canAfford(method, quote) ? "eligible" : "insufficient" };
      } catch (error) {
        if (signal.aborted) throw error;
        results[index] = { key, status: "unavailable" };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, wallets.length) }, worker));
  return results;
}
