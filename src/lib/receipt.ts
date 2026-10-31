import type { Order } from "./types";
import { orderBuyerFee, orderBuyerTotal } from "./commerce-payments";
export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
export function receiptText(order: Order, language = "en") {
  const fr = language === "fr";
  const buyerFee = orderBuyerFee(order);
  const total = orderBuyerTotal(order);
  const amount = (v: number | undefined, c: string | undefined) =>
    v == null
      ? "—"
      : new Intl.NumberFormat(language, {
          style: "currency",
          currency: c || order.totalCurrency,
        }).format(v);
  return [
    order.storeName || "Fondeka",
    fr ? "Reçu" : "Receipt",
    order.reference,
    new Date(order.createdAt).toLocaleString(language),
    order.buyerName || (fr ? "Client de passage" : "Walk-in customer"),
    ...(order.items || []).map(
      (i) =>
        `${i.productName || ""} × ${i.quantity} · ${amount(i.totalAmount ?? i.lineTotalAmount, i.totalCurrency ?? i.lineTotalCurrency)}`,
    ),
    order.commerceSubtotalAmount != null
      ? `${fr ? "Sous-total des produits" : "Product subtotal"}: ${amount(order.commerceSubtotalAmount, order.paymentCurrency || order.totalCurrency)}`
      : "",
    buyerFee != null
      ? `${fr ? "Frais ajoutés au total" : "Fees added to buyer total"}: ${amount(buyerFee, order.feeCurrency || order.paymentCurrency || order.totalCurrency)}`
      : "",
    `Total: ${amount(total.amount, total.currency)}`,
    `${fr ? "Payé" : "Paid"}: ${amount(order.amountPaid, order.amountPaidCurrency)}`,
    `${fr ? "Solde dû" : "Balance due"}: ${amount(order.balanceDue ?? order.outstandingAmount, order.balanceDueCurrency ?? order.outstandingCurrency)}`,
    order.paymentDueDate ? `${fr ? "Échéance" : "Due date"}: ${order.paymentDueDate}` : "",
    order.posPaymentStatus || order.status,
  ]
    .filter(Boolean)
    .join("\n");
}
export function receiptHtml(order: Order, language = "en") {
  return `<!doctype html><html lang="${language === "fr" ? "fr" : "en"}"><meta charset="utf-8"><title>${escapeHtml(order.reference)}</title><style>body{font:15px system-ui;max-width:640px;margin:40px auto;padding:20px;color:#172431}pre{font:inherit;white-space:pre-wrap;line-height:1.8}h1{font-size:24px}</style><h1>Fondeka</h1><pre>${escapeHtml(receiptText(order, language))}</pre></html>`;
}
