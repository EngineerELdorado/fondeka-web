"use client";
import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { money, date, label } from "@/lib/format";
import { useWorkspace } from "@/components/workspace-provider";
import {
  Badge,
  Loading,
  Empty,
  ErrorState,
  PageHeading,
  Modal,
  Pagination,
  MobileRecord,
} from "@/components/ui";
import { PaymentForm } from "@/components/payment-form";
import { LinkSharing } from "@/components/link-sharing";
import { CollectionDialog } from "@/components/collection-dialog";
import type { Page, PaymentRequest, RequestPayment } from "@/lib/types";
export default function PaymentLinks() {
  const { t } = useI18n();
  const { values, update, page } = useUrlState();
  const { refresh } = useWorkspace();
  const search = values.get("search") || "";
  const status = values.get("status") || "";
  const type = values.get("type") || "";
  const payments = useQuery<Page<PaymentRequest>>(
    `/customer-api/payment_requests?page=${page}&size=20`,
  );
  const id = values.get("request");
  const creating = values.get("new") === "1";
  const items = payments.data?.content.filter(
    (p) =>
      (!status || p.lifecycle === status) &&
      (!type || p.type === type) &&
      `${p.title} ${p.linkCode}`.toLowerCase().includes(search.toLowerCase()),
  );
  if (creating)
    return (
      <PaymentForm
        onClose={() => update({ new: null, step: null, flow: null })}
        onCreated={(p) => update({ new: null, step: null, flow: null, request: p.id })}
      />
    );
  return (
    <>
      <PageHeading
        title={t("Payment links", "Liens de paiement")}
        description={t(
          "Quick collections, crowdfunding and invoices",
          "Encaissements rapides, financement participatif et factures",
        )}
      >
        <button className="button secondary" onClick={refresh}>
          <RefreshCw size={16} />
          {t("Refresh", "Actualiser")}
        </button>
        <button className="button primary" onClick={() => update({ new: 1, request: null })}>
          <Plus size={17} />
          {t("Create request", "Créer une demande")}
        </button>
      </PageHeading>
      <section className="panel">
        <div className="list-toolbar inset parity-filters">
          <label>
            {t("Search this page", "Rechercher sur cette page")}
            <input value={search} onChange={(e) => update({ search: e.target.value }, true)} />
          </label>
          <label>
            {t("Type", "Type")}
            <select value={type} onChange={(e) => update({ type: e.target.value }, true)}>
              <option value="">{t("All types", "Tous les types")}</option>
              {["QUICK_CHARGE", "INVOICE", "DONATION"].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Status", "Statut")}
            <select value={status} onChange={(e) => update({ status: e.target.value }, true)}>
              <option value="">{t("All statuses", "Tous les statuts")}</option>
              {["DRAFT", "ACTIVE", "SUSPENDED", "COMPLETED", "CANCELLED", "EXPIRED"].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {payments.loading ? (
          <Loading />
        ) : payments.error ? (
          <ErrorState message={payments.error} retry={refresh} />
        ) : !items?.length ? (
          <Empty
            title={t("Your payment links", "Vos liens de paiement")}
            description={t(
              "Create a request to collect payments or try another filter on this page.",
              "Créez une demande pour encaisser des paiements ou essayez un autre filtre sur cette page.",
            )}
          >
            <button className="button primary" onClick={() => update({ new: 1 })}>
              {t("Create request", "Créer une demande")}
            </button>
          </Empty>
        ) : (
          <>
            <div className="table-wrap desktop-table">
              <table>
                <thead>
                  <tr>
                    {[
                      t("Request", "Demande"),
                      t("Type", "Type"),
                      t("Amount", "Montant"),
                      t("Collected", "Collecté"),
                      t("Status", "Statut"),
                      t("Date", "Date"),
                    ].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="text-button table-name"
                          onClick={() => update({ request: p.id })}
                        >
                          {p.title || t("Quick Charge", "Encaissement rapide")}
                        </button>
                        <small className="table-subtitle">{p.linkCode}</small>
                      </td>
                      <td>{label(p.type)}</td>
                      <td className="amount">
                        {p.amount == null
                          ? t("Variable amount", "Montant libre")
                          : money(p.amount, p.currency)}
                      </td>
                      <td>{money(p.totalCollected, p.currency)}</td>
                      <td>
                        <Badge value={p.lifecycle} />
                      </td>
                      <td>{date(p.activationAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-record-list">
              {items.map((p) => (
                <MobileRecord
                  key={p.id}
                  title={p.title || t("Quick Charge", "Encaissement rapide")}
                  subtitle={`${label(p.type)} · ${p.linkCode}`}
                  amount={
                    p.amount == null
                      ? t("Variable amount", "Montant libre")
                      : money(p.amount, p.currency)
                  }
                  status={p.lifecycle}
                  onClick={() => update({ request: p.id })}
                />
              ))}
            </div>
          </>
        )}
        {payments.data && (
          <Pagination
            page={page}
            pages={payments.data.totalPages}
            total={payments.data.totalElements}
            onChange={(p) => update({ page: p })}
          />
        )}
      </section>
      {id && /^\d+$/.test(id) && (
        <RequestDetail id={Number(id)} onClose={() => update({ request: null })} />
      )}
    </>
  );
}
function RequestDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useI18n();
  const { refresh, notify } = useWorkspace();
  const payment = useQuery<PaymentRequest>(`/customer-api/payment_requests/${id}`);
  const [page, setPage] = useState(0);
  const payments = useQuery<Page<RequestPayment>>(
    `/customer-api/payment_requests/${id}/payments?page=${page}&size=20`,
  );
  const [editing, setEditing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [confirmation, setConfirmation] = useState<"cancel" | "delete">();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payer, setPayer] = useState<RequestPayment>();
  async function mutate() {
    if (!confirmation || busy) return;
    setBusy(true);
    setError("");
    try {
      await request(
        `/customer-api/payment_requests/${id}${confirmation === "cancel" ? "/cancel" : ""}`,
        { method: confirmation === "cancel" ? "PATCH" : "DELETE" },
      );
      invalidateQueryPaths(["/customer-api/payment_requests"]);
      notify(t("Request updated.", "Demande modifiée."));
      if (confirmation === "delete") onClose();
      else setConfirmation(undefined);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to update request.", "Impossible de modifier la demande."),
      );
    } finally {
      setBusy(false);
    }
  }
  const p = payment.data;
  if (editing && p)
    return (
      <PaymentForm
        payment={p}
        onClose={() => setEditing(false)}
        onCreated={() => {
          setEditing(false);
        }}
      />
    );
  if (collecting && p)
    return (
      <CollectionDialog
        payment={p}
        onClose={() => {
          setCollecting(false);
          refresh();
        }}
        onDone={refresh}
      />
    );
  return (
    <Modal
      title={p?.title || t("Payment request", "Demande de paiement")}
      onClose={onClose}
      busy={busy}
      className="owner-detail-dialog"
    >
      {payment.loading ? (
        <Loading />
      ) : payment.error ? (
        <ErrorState message={payment.error} retry={refresh} />
      ) : (
        p && (
          <>
            <div className="transaction-hero">
              <strong>
                {p.amount == null
                  ? t("Variable amount", "Montant libre")
                  : money(p.amount, p.currency)}
              </strong>
              <Badge value={p.lifecycle} />
            </div>
            <p className="muted">
              {label(p.type)} · {p.linkCode}
            </p>
            {p.description && <p>{p.description}</p>}
            <dl className="detail-list">
              <div>
                <dt>{t("Total collected", "Total collecté")}</dt>
                <dd>{money(p.totalCollected, p.currency)}</dd>
              </div>
              <div>
                <dt>{t("Approval", "Approbation")}</dt>
                <dd>
                  <Badge value={p.approvalStatus} />
                </dd>
              </div>
              <div>
                <dt>{t("Activation", "Activation")}</dt>
                <dd>{date(p.activationAt)}</dd>
              </div>
              <div>
                <dt>{t("Expiry", "Expiration")}</dt>
                <dd>{date(p.expiresAt)}</dd>
              </div>
            </dl>
            <LinkSharing url={p.paymentLink} title={p.title || p.linkCode} />
            <div className="parity-actions">
              {p.lifecycle === "ACTIVE" && (
                <>
                  <button className="button primary" onClick={() => setCollecting(true)}>
                    {t("Collect", "Encaisser")}
                  </button>
                  <button className="button secondary" onClick={() => setEditing(true)}>
                    {t("Edit", "Modifier")}
                  </button>
                </>
              )}
              {!["COMPLETED", "CANCELLED", "EXPIRED"].includes(p.lifecycle) && (
                <button className="button secondary" onClick={() => setConfirmation("cancel")}>
                  {t("Cancel request", "Annuler la demande")}
                </button>
              )}
              <button className="text-button danger-text" onClick={() => setConfirmation("delete")}>
                {t("Delete", "Supprimer")}
              </button>
              <button
                className="icon-button"
                aria-label={t("Refresh", "Actualiser")}
                onClick={refresh}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {confirmation && (
              <div className="confirmation-box">
                <p>
                  {confirmation === "cancel"
                    ? t(
                        "Cancel this request? It will no longer accept new payments.",
                        "Annuler cette demande ? Elle n’acceptera plus de nouveaux paiements.",
                      )
                    : t(
                        "Delete this request? The backend permits deletion only when there are no payment attempts.",
                        "Supprimer cette demande ? Le serveur autorise la suppression uniquement sans tentative de paiement.",
                      )}
                </p>
                <div className="parity-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => setConfirmation(undefined)}
                  >
                    {t("Back", "Retour")}
                  </button>
                  <button className="button danger" disabled={busy} onClick={() => void mutate()}>
                    {t("Confirm", "Confirmer")}
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <h3 className="section-title">{t("Payment history", "Historique des paiements")}</h3>
            {payments.loading ? (
              <Loading />
            ) : payments.error ? (
              <ErrorState message={payments.error} retry={refresh} />
            ) : !payments.data?.content.length ? (
              <p className="muted">{t("No payments yet.", "Aucun paiement pour le moment.")}</p>
            ) : (
              payments.data.content.map((row) => (
                <button className="detail-row" key={row.id} onClick={() => setPayer(row)}>
                  <span>
                    {row.payerAnonymous
                      ? t("Anonymous", "Anonyme")
                      : row.payerName || row.payerReference || t("Payer", "Payeur")}
                    <small>{date(row.createdAt)}</small>
                  </span>
                  <strong>{money(row.amount, p.currency)}</strong>
                </button>
              ))
            )}
            {payments.data && (
              <Pagination
                page={page}
                pages={payments.data.totalPages}
                total={payments.data.totalElements}
                onChange={setPage}
              />
            )}
            {payer && (
              <section className="payer-details">
                <h3>{t("Payer details", "Informations du payeur")}</h3>
                <dl className="detail-list">
                  {[
                    [t("Name", "Nom"), payer.payerName],
                    [t("Phone", "Téléphone"), payer.phoneNumber],
                    [t("Reference", "Référence"), payer.payerReference],
                    [t("Date", "Date"), date(payer.createdAt)],
                    ...Object.entries(payer.payerFields || {}),
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {payer.transactionId && <TransactionSummary id={payer.transactionId} />}
                <button className="text-button" onClick={() => setPayer(undefined)}>
                  {t("Close details", "Fermer les détails")}
                </button>
              </section>
            )}
          </>
        )
      )}
    </Modal>
  );
}
function TransactionSummary({ id }: { id: number }) {
  const { t } = useI18n();
  const tx = useQuery<{ reference?: string; status?: string; amount?: number; currency?: string }>(
    `/customer-api/transactions/${id}`,
  );
  return tx.loading ? (
    <Loading rows={2} />
  ) : tx.error ? (
    <p role="alert">{tx.error}</p>
  ) : (
    <div className="info-box">
      <strong>
        {t("Transaction", "Transaction")} {tx.data?.reference || id}
      </strong>
      <p>
        {money(tx.data?.amount, tx.data?.currency)} · {label(tx.data?.status)}
      </p>
    </div>
  );
}
