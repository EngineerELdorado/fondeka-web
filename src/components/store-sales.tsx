"use client";
import { ExpenseReportMetrics } from "./store-expenses";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { useUrlState } from "@/lib/use-url-state";
import { money, date, label } from "@/lib/format";
import { receiptHtml, receiptText } from "@/lib/receipt";
import { orderBuyerFee, orderBuyerTotal } from "@/lib/commerce-payments";
import { reportQuery, canUseStore, isStoreOwner } from "@/lib/commerce";
import { posOrderPath } from "@/lib/pos-payment";
import type { Order, Page, SalesReport, Store } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { Badge, Loading, ErrorState, Empty, Modal, Pagination } from "./ui";
import { CollectionDialog } from "./collection-dialog";
import { SaleManagement } from "./sale-management";
import { ReportExportButton } from "./store-report-export";
import { invalidateQueryPaths } from "@/lib/query-cache";
export function SalesPanel({ store, customerId }: { store: Store; customerId?: number }) {
  const storeId = store.id;
  const { t } = useI18n();
  const { refresh } = useWorkspace();
  const { values, update, page } = useUrlState();
  const customerPage = Math.max(0, Number(values.get("customerSalesPage")) || 0);
  const current = customerId ? customerPage : page;
  const list = useQuery<Page<Order>>(
    `/customer-api/commerce/stores/${storeId}${customerId ? `/customers/${customerId}` : ""}/orders?page=${current}&size=20`,
  );
  const selected = list.data?.content.find((o) => o.reference === values.get("sale"));
  return (
    <>
      <div className="panel-heading">
        <h2>{t("Sales", "Ventes")}</h2>
        <button className="text-button" onClick={refresh}>
          {t("Refresh", "Actualiser")}
        </button>
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorState message={list.error} retry={refresh} />
      ) : !list.data?.content.length ? (
        <Empty
          title={t("Your first sale is waiting", "Votre première vente vous attend")}
          description={t(
            "Online and POS sales appear here with customer and payment details.",
            "Les ventes en ligne et POS apparaissent ici avec le client et le paiement.",
          )}
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  t("Reference", "Référence"),
                  t("Customer", "Client"),
                  t("Amount", "Montant"),
                  t("Paid", "Payé"),
                  t("Balance due", "Solde dû"),
                  t("Date", "Date"),
                  t("Status", "Statut"),
                  t("Actions", "Actions"),
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.content.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button className="text-button" onClick={() => update({ sale: o.reference })}>
                      {o.reference}
                    </button>
                  </td>
                  <td>{o.buyerName || t("Walk-in customer", "Client de passage")}</td>
                  <td className="amount">{money(o.totalAmount, o.totalCurrency)}</td>
                  <td className="amount">
                    {money(o.amountPaid, o.amountPaidCurrency || o.totalCurrency)}
                  </td>
                  <td className="amount">
                    {money(
                      o.balanceDue ?? o.outstandingAmount,
                      o.balanceDueCurrency || o.outstandingCurrency || o.totalCurrency,
                    )}
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>
                    <Badge value={o.posPaymentStatus || o.status} />
                  </td>
                  <td>
                    <button
                      className="button secondary"
                      onClick={() => update({ sale: o.reference })}
                    >
                      {o.channel === "POS"
                        ? t("Manage sale", "Gérer la vente")
                        : t("View details", "Voir les détails")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && (
        <Pagination
          page={current}
          pages={list.data.totalPages}
          total={list.data.totalElements}
          onChange={(v) => (customerId ? update({ customerSalesPage: v }) : update({ page: v }))}
        />
      )}
      {selected && (
        <SaleDetail order={selected} store={store} onClose={() => update({ sale: null })} />
      )}
    </>
  );
}
export function SaleDetail({
  order,
  store,
  onClose,
  onNewSale,
}: {
  order: Order;
  store: Store;
  onClose: () => void;
  onNewSale?: () => void;
}) {
  const { t, language } = useI18n();
  const { refresh, notify } = useWorkspace();
  const scopedPos =
    store.accessType === "STAFF" && order.channel === "POS" && canUseStore(store, "POS");
  const details = useQuery<Order>(
    order.channel === "POS" && canUseStore(store, "POS")
      ? posOrderPath(store.id, order.reference)
      : order.accessToken
        ? `/customer-api/commerce/orders/${encodeURIComponent(order.reference)}?${new URLSearchParams({ accessToken: order.accessToken })}`
        : null,
  );
  const [updatedSale, setUpdatedSale] = useState<Order>();
  const current = details.data || order;
  const sale =
    updatedSale && (updatedSale.version ?? -1) >= (current.version ?? -1) ? updatedSale : current;
  const [collect, setCollect] = useState(false);
  const transaction = useQuery<{
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
  }>(
    !scopedPos && isStoreOwner(store) && sale.paymentTransactionId
      ? `/customer-api/transactions/${sale.paymentTransactionId}`
      : null,
  );
  async function share() {
    const text = receiptText(sale, language);
    try {
      if (navigator.share) await navigator.share({ title: sale.reference, text });
      else {
        await navigator.clipboard.writeText(text);
        notify(t("Receipt copied.", "Reçu copié."));
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        notify(
          t(
            "Select Download to save the receipt.",
            "Choisissez Télécharger pour enregistrer le reçu.",
          ),
        );
    }
  }
  function print() {
    const win = window.open("", "_blank", "noopener=false,width=700,height=800");
    if (!win) {
      notify(
        t(
          "Allow popups to print this receipt.",
          "Autorisez les fenêtres contextuelles pour imprimer le reçu.",
        ),
      );
      return;
    }
    win.opener = null;
    win.document.write(receiptHtml(sale, language));
    win.document.close();
    win.focus();
    win.print();
  }
  function download() {
    const href = URL.createObjectURL(
      new Blob([receiptHtml(sale, language)], { type: "text/html" }),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = `receipt-${sale.reference.replace(/[^a-zA-Z0-9_-]/g, "")}.html`;
    a.click();
    URL.revokeObjectURL(href);
  }
  if (collect)
    return (
      <CollectionDialog
        order={sale}
        store={sale.channel === "POS" ? store : undefined}
        onDone={refresh}
        onClose={() => {
          setCollect(false);
          refresh();
        }}
      />
    );
  return (
    <Modal
      title={t("Sale details", "Détails de la vente")}
      description={sale.reference}
      onClose={onClose}
      className="owner-detail-dialog"
    >
      <div className="transaction-hero">
        <strong>{money(orderBuyerTotal(sale).amount, orderBuyerTotal(sale).currency)}</strong>
        <Badge value={sale.posPaymentStatus || sale.status} />
      </div>
      {details.loading && <Loading rows={2} />}{" "}
      {details.error && <ErrorState message={details.error} retry={refresh} />}
      {sale.channel === "POS" && (
        <SaleManagement
          store={store}
          sale={sale}
          onUpdated={(value) => {
            setUpdatedSale(value);
            invalidateQueryPaths([
              `/customer-api/commerce/stores/${store.id}/orders`,
              `/customer-api/commerce/stores/${store.id}/customers`,
              `/customer-api/commerce/stores/${store.id}/pos/orders`,
              `/customer-api/commerce/stores/${store.id}/pos/products`,
              `/customer-api/commerce/stores/${store.id}/products`,
              `/customer-api/commerce/stores/${store.id}/reports`,
              "/customer-api/commerce/orders",
            ]);
            notify(t("Sale updated.", "Vente mise à jour."));
            void details.refetch();
          }}
        />
      )}
      <dl className="detail-list">
        {[
          [t("Store", "Boutique"), sale.storeName],
          [t("Customer", "Client"), sale.buyerName || t("Walk-in customer", "Client de passage")],
          [t("Phone", "Téléphone"), sale.buyerPhone],
          [t("Email", "E-mail"), sale.buyerEmail],
          [t("Date", "Date"), date(sale.createdAt)],
          [t("Channel", "Canal"), label(sale.channel)],
          [t("Payment method", "Moyen de paiement"), label(sale.posPaymentMode)],
          ...(sale.commerceSubtotalAmount != null
            ? [
                [
                  t("Product subtotal", "Sous-total des produits"),
                  money(sale.commerceSubtotalAmount, sale.paymentCurrency || sale.totalCurrency),
                ],
              ]
            : []),
          ...(orderBuyerFee(sale) != null
            ? [
                [
                  t("Fees added to buyer total", "Frais ajoutés au total"),
                  money(
                    orderBuyerFee(sale),
                    sale.feeCurrency || sale.paymentCurrency || sale.totalCurrency,
                  ),
                ],
              ]
            : []),
          ...(sale.merchantFeeAmount != null
            ? [
                [
                  t("Fees deducted from proceeds", "Frais déduits des recettes"),
                  money(
                    sale.merchantFeeAmount,
                    sale.feeCurrency || sale.paymentCurrency || sale.totalCurrency,
                  ),
                ],
              ]
            : []),
          [
            t("Paid", "Payé"),
            money(sale.amountPaid, sale.amountPaidCurrency || sale.totalCurrency),
          ],
          [
            t("Balance due", "Solde dû"),
            money(
              sale.balanceDue ?? sale.outstandingAmount,
              sale.balanceDueCurrency || sale.outstandingCurrency || sale.totalCurrency,
            ),
          ],
          [t("Due date", "Échéance"), sale.paymentDueDate],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <h3>{t("Items", "Articles")}</h3>
      {sale.items?.map((i, index) => (
        <div className="detail-row" key={index}>
          <span>
            {i.productName} × {i.quantity}
          </span>
          <strong>
            {money(
              i.totalAmount ?? i.lineTotalAmount,
              i.totalCurrency || i.lineTotalCurrency || sale.totalCurrency,
            )}
          </strong>
        </div>
      ))}
      {sale.discount && (
        <div className="correction-preview">
          <div className="detail-row">
            <span>{t("Before discount", "Avant remise")}</span>
            <strong>
              {money(
                sale.subtotalBeforeDiscountAmount,
                sale.discountCurrency || sale.totalCurrency,
              )}
            </strong>
          </div>
          <div className="detail-row">
            <span>{t("Customer discount", "Remise client")}</span>
            <strong>
              − {money(sale.discountAmount, sale.discountCurrency || sale.totalCurrency)}
            </strong>
          </div>
          <p className="muted small">{sale.discount.reason}</p>
        </div>
      )}
      {transaction.data && (
        <div className="info-box">
          <strong>
            {t("Linked transaction", "Transaction liée")}{" "}
            {transaction.data.reference || sale.paymentTransactionId}
          </strong>
          <p>
            {label(transaction.data.status)} ·{" "}
            {money(transaction.data.amount, transaction.data.currency)}
          </p>
        </div>
      )}
      {transaction.error && <ErrorState message={transaction.error} retry={refresh} />}
      <div className="parity-actions">
        <button className="button secondary" onClick={() => void share()}>
          {t("Share receipt", "Partager le reçu")}
        </button>
        <button className="button secondary" onClick={print}>
          {t("Print", "Imprimer")}
        </button>
        <button className="button secondary" onClick={download}>
          {t("Download", "Télécharger")}
        </button>
        {sale.posPaymentMode === "FONDEKA" &&
          sale.status === "PENDING_PAYMENT" &&
          (scopedPos || sale.accessToken) && (
            <button className="button primary" onClick={() => setCollect(true)}>
              {sale.paymentTransactionId
                ? t("Payment status", "Statut du paiement")
                : t("Collect", "Encaisser")}
            </button>
          )}
        <button className="text-button" onClick={refresh}>
          {t("Refresh", "Actualiser")}
        </button>
      </div>
      {onNewSale && (
        <button className="button primary new-sale-button" onClick={onNewSale}>
          {t("Start another sale", "Commencer une nouvelle vente")}
        </button>
      )}
    </Modal>
  );
}
export function ReportsPanel({ store }: { store: Store }) {
  const storeId = store.id;
  const { t } = useI18n();
  const { values, update } = useUrlState();
  const { refresh } = useWorkspace();
  const period = values.get("period") || "today";
  const currency = values.get("currency") || "";
  const from = values.get("from") || "";
  const to = values.get("to") || "";
  let query = "";
  let error = "";
  try {
    query = reportQuery(
      period,
      currency,
      from,
      to,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
  } catch {
    error = t("Choose a valid date range.", "Choisissez une période valide.");
  }
  const report = useQuery<SalesReport>(
    !error ? `/customer-api/commerce/stores/${storeId}/reports/sales?${query}` : null,
  );
  const r = report.data;
  return (
    <>
      <div className="panel-heading">
        <h2>{t("Reports", "Rapports")}</h2>
        <div className="heading-actions">
          <button className="text-button" onClick={refresh}>
            {t("Refresh", "Actualiser")}
          </button>
          {r && !error && !report.loading && !report.error && (
            <ReportExportButton key={storeId} store={store} report={r} />
          )}
        </div>
      </div>
      <div className="parity-filters inset">
        <label>
          {t("Period", "Période")}
          <select value={period} onChange={(e) => update({ period: e.target.value })}>
            {[
              ["today", t("Today", "Aujourd’hui")],
              ["last_7_days", t("Last 7 days", "7 derniers jours")],
              ["last_30_days", t("Last 30 days", "30 derniers jours")],
              ["all", t("All time", "Toute la période")],
              ["custom", t("Custom", "Personnalisée")],
            ].map(([v, title]) => (
              <option value={v} key={v}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Currency", "Devise")}
          <select value={currency} onChange={(e) => update({ currency: e.target.value })}>
            <option value="">{t("Store default", "Devise de la boutique")}</option>
            {r?.availableCurrencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label>
              {t("From", "Du")}
              <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} />
            </label>
            <label>
              {t("To", "Au")}
              <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} />
            </label>
          </>
        )}
      </div>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : report.loading ? (
        <Loading />
      ) : report.error ? (
        <ErrorState message={report.error} retry={refresh} />
      ) : (
        r && (
          <div className="report-content">
            <p className="muted">
              {r.fromDate} — {r.toDate} · {r.currency} · {r.timeZone}
            </p>
            <ExpenseReportMetrics report={r} />
            <div className="report-grid">
              {[
                [t("Sales", "Ventes"), money(r.totalSalesAmount, r.currency)],
                [t("Paid", "Payé"), money(r.amountPaid, r.currency)],
                [t("Balance due", "Solde dû"), money(r.balanceDue, r.currency)],
                [
                  t("Merchant proceeds", "Montant commerçant"),
                  money(r.merchantProceedsAmount, r.currency),
                ],
                [t("Orders", "Commandes"), r.orderCount],
                ...(r.discountAmount != null
                  ? [[t("Discounts", "Remises"), money(r.discountAmount, r.currency)]]
                  : []),
                ...(r.voidedOrderCount != null
                  ? [[t("Voided sales", "Ventes annulées"), r.voidedOrderCount]]
                  : []),
                ...(r.paymentsReceivedAmount != null
                  ? [
                      [
                        t("Payments received in period", "Paiements reçus sur la période"),
                        money(r.paymentsReceivedAmount, r.paymentsReceivedCurrency || r.currency),
                      ],
                    ]
                  : []),
                [
                  t("Paid / partial / credit", "Payées / partielles / à crédit"),
                  `${r.paidOrderCount} / ${r.partialOrderCount} / ${r.creditOrderCount}`,
                ],
              ].map(([title, value]) => (
                <div className="report-metric" key={title}>
                  <small>{title}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <h3>{t("Top products", "Produits les plus vendus")}</h3>
            {!r.topProducts?.length && (
              <p className="muted">
                {t(
                  "No product sales in this period.",
                  "Aucune vente de produit sur cette période.",
                )}
              </p>
            )}
            {r.topProducts?.map((p, i) => (
              <div className="detail-row" key={i}>
                <span>{p.productName}</span>
                <strong>{money(p.salesAmount, p.salesCurrency || r.currency)}</strong>
              </div>
            ))}
            <h3>{t("Unpaid customers", "Clients avec un solde dû")}</h3>
            {!r.unpaidCustomers?.length && (
              <p className="muted">
                {t(
                  "No outstanding customer balance in this period.",
                  "Aucun solde client dû sur cette période.",
                )}
              </p>
            )}
            {r.unpaidCustomers?.map((c, i) => (
              <div className="detail-row" key={i}>
                <span>{c.buyerName || c.customerName || t("Customer", "Client")}</span>
                <strong>{money(c.balanceDue, c.balanceDueCurrency || r.currency)}</strong>
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
