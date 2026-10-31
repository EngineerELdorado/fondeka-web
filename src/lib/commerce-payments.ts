import {
  isPositiveId,
  parseQuote,
  type AccessQuote,
  type PaymentSelection,
} from "./business-tools";
import type { Order, PosInput } from "./types";

export type CommercePaymentContext =
  | { kind: "ORDER"; reference: string; accessToken?: string; storeId?: number }
  | { kind: "CHECKOUT"; checkoutId: number; accessToken: string }
  | { kind: "POS_SALE"; storeId: number; sale: PosInput };

export interface CommercePaymentQuote extends AccessQuote {
  commerceSubtotalAmount: number;
  buyerFeeAmount: number;
  merchantFeeAmount: number;
  productFeeApplicationMode: "LEGACY" | "EXCLUSIVE" | "INCLUSIVE" | "MIXED";
  netAmount: number;
  netAmountCurrency: string;
  grossAmount: number;
  grossAmountCurrency: string;
}

/** Product/account policy is resolved by Commerce. Never turn an unset product into EXCLUSIVE. */
export function commercePaymentSelection(selection: PaymentSelection) {
  return {
    id: selection.id,
    currency: selection.currency,
    ...(selection.accountRef !== undefined ? { accountRef: selection.accountRef } : {}),
    ...(selection.networkId !== undefined ? { networkId: selection.networkId } : {}),
    ...(selection.fiatWalletId !== undefined ? { fiatWalletId: selection.fiatWalletId } : {}),
  };
}

export function commerceQuoteRequest(context: CommercePaymentContext, selection: PaymentSelection) {
  const selected = commercePaymentSelection(selection);
  if (!isPositiveId(selected.id)) throw new Error("Choose a payment method.");
  // A quote does not need the buyer's phone number or a payment-start idempotency key.
  const payment = {
    paymentMethod: {
      id: selected.id,
      currency: selected.currency,
      ...(selected.networkId !== undefined ? { networkId: selected.networkId } : {}),
      ...(selected.fiatWalletId !== undefined ? { fiatWalletId: selected.fiatWalletId } : {}),
    },
  };
  let path: string;
  let body: object = payment;
  if (context.kind === "POS_SALE") {
    if (!isPositiveId(context.storeId) || context.sale.paymentCurrency !== selection.currency)
      throw new Error("Choose a method in the sale’s payment currency.");
    path = `/customer-api/commerce/stores/${context.storeId}/pos/payments/quote`;
    body = { sale: context.sale, payment };
  } else {
    if (context.kind === "ORDER" && !/^[A-Za-z0-9_-]{1,128}$/.test(context.reference))
      throw new Error("Invalid Commerce order.");
    if (context.kind === "ORDER" && context.storeId !== undefined) {
      if (!isPositiveId(context.storeId)) throw new Error("Invalid POS store.");
      path = `/customer-api/commerce/stores/${context.storeId}/pos/orders/${context.reference}/payments/quote`;
    } else {
      if (!context.accessToken) throw new Error("Open the order again before collecting payment.");
      if (context.kind === "CHECKOUT" && !isPositiveId(context.checkoutId))
        throw new Error("Invalid Commerce checkout.");
      const resource =
        context.kind === "ORDER"
          ? `orders/${context.reference}`
          : `checkouts/${context.checkoutId}`;
      path = `/customer-api/commerce/${resource}/payments/quote?${new URLSearchParams({ accessToken: context.accessToken })}`;
    }
  }
  return { path, init: { method: "POST", body: JSON.stringify(body), cache: "no-store" } as const };
}

/** Keep collection fees and merchant net intact; buyer totals use the explicit Commerce fields. */
export function parseCommerceQuote(value: unknown, currency: string): CommercePaymentQuote {
  const quote = parseQuote(value, ["EXCLUSIVE", "INCLUSIVE"]) as CommercePaymentQuote;
  const amounts = [
    quote.commerceSubtotalAmount,
    quote.buyerFeeAmount,
    quote.merchantFeeAmount,
    quote.netAmount,
    quote.grossAmount,
  ];
  if (
    amounts.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    quote.commerceSubtotalAmount <= 0 ||
    !["LEGACY", "EXCLUSIVE", "INCLUSIVE", "MIXED"].includes(quote.productFeeApplicationMode) ||
    [
      quote.totalToPayCurrency,
      quote.feesCurrency,
      quote.netAmountCurrency,
      quote.grossAmountCurrency,
    ].some((code) => code !== currency)
  )
    throw new Error("A final Commerce payment quote is unavailable. Refresh and try again.");
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const units = (amount: number) => Math.round(amount * 10 ** digits);
  if (
    [...amounts, quote.fees, quote.totalToPay].some(
      (amount) =>
        !Number.isSafeInteger(units(amount)) ||
        Math.abs(amount * 10 ** digits - units(amount)) > 0.000001,
    ) ||
    units(quote.commerceSubtotalAmount) + units(quote.buyerFeeAmount) !== units(quote.totalToPay) ||
    units(quote.buyerFeeAmount) + units(quote.merchantFeeAmount) !== units(quote.fees) ||
    units(quote.totalToPay) - units(quote.fees) !== units(quote.netAmount) ||
    units(quote.grossAmount) !== units(quote.totalToPay)
  )
    throw new Error("The Commerce payment totals changed. Refresh and review the quote again.");
  return quote;
}

/** Preserve an explicit zero buyer fee. Historical payloads retain their existing fee fallback. */
export const orderBuyerFee = (order: Order) => order.buyerFeeAmount ?? order.feeAmount;

export function orderBuyerTotal(order: Order) {
  return order.buyerFeeAmount != null && order.paymentAmount != null
    ? { amount: order.paymentAmount, currency: order.paymentCurrency || order.totalCurrency }
    : { amount: order.totalAmount, currency: order.totalCurrency };
}
