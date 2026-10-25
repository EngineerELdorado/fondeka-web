import type { PaymentMethod } from "./business-tools";
export const paymentGroupOrder = ["BALANCE", "MOBILE_MONEY", "CRYPTO", "BANK"] as const;
export type PaymentGroupType = (typeof paymentGroupOrder)[number];
export function groupPaymentMethods(methods: PaymentMethod[]) {
  return paymentGroupOrder
    .map((type) => ({
      type,
      methods: methods
        .filter((method) => method.type === type)
        .sort(
          type === "BALANCE"
            ? (a, b) => {
                const priority = Number(b.currency === "USD") - Number(a.currency === "USD");
                if (priority) return priority;
                const balanceA =
                  typeof a.balance === "number" && Number.isFinite(a.balance)
                    ? a.balance
                    : -Infinity;
                const balanceB =
                  typeof b.balance === "number" && Number.isFinite(b.balance)
                    ? b.balance
                    : -Infinity;
                return balanceA === balanceB ? 0 : balanceB - balanceA;
              }
            : undefined,
        ),
    }))
    .filter((group) => group.methods.length > 0);
}
