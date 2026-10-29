import type { Order } from "./types";
import type { PaymentSelection, PaymentTransaction } from "./business-tools";

export function posOrderPath(storeId: number, reference: string) {
  if (!Number.isSafeInteger(storeId) || storeId <= 0 || !/^[A-Za-z0-9_-]{1,128}$/.test(reference))
    throw new Error("Invalid POS order.");
  return `/customer-api/commerce/stores/${storeId}/pos/orders/${encodeURIComponent(reference)}`;
}
export function posPaymentBody(selection: PaymentSelection, idempotencyKey: string) {
  if (selection.fiatWalletId !== undefined)
    throw new Error("Balance payments are unavailable for this POS payment.");
  return {
    paymentMethodId: selection.id,
    accountNumber: selection.accountRef,
    networkId: selection.networkId,
    currency: selection.currency,
    idempotencyKey,
  };
}
export function posOrderTransaction(
  order: Order,
  storeId: number,
  reference: string,
): PaymentTransaction {
  if (
    !order ||
    order.storeId !== storeId ||
    order.reference !== reference ||
    order.channel !== "POS" ||
    !Number.isSafeInteger(order.paymentTransactionId) ||
    Number(order.paymentTransactionId) <= 0
  )
    throw new Error(
      "The POS payment status could not be verified. Refresh the existing order before starting another payment.",
    );
  return {
    id: order.paymentTransactionId!,
    reference: order.paymentTransactionReference,
    status: order.paymentTransactionStatus,
    grossAmount: order.paymentAmount,
    currency: order.paymentCurrency,
    cryptoDetails: order.cryptoDetails
      ? {
          address: order.cryptoDetails.address ?? undefined,
          cryptoCurrency: order.cryptoDetails.cryptoCurrency ?? undefined,
          network: order.cryptoDetails.network ?? undefined,
          amountInCrypto: order.cryptoDetails.amountInCrypto ?? undefined,
          exchangeRate: order.cryptoDetails.exchangeRate ?? undefined,
          exchangeRateCurrency: order.cryptoDetails.exchangeRateCurrency ?? undefined,
          invoiceUrl: order.cryptoDetails.invoiceUrl ?? undefined,
          expiresAt: order.cryptoDetails.expiresAt ?? undefined,
        }
      : order.cryptoDetails,
  };
}
