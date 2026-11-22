"use client";
import { useState } from "react";
import { Plus, Pencil, Ban, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { useWorkspace } from "./workspace-provider";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { uiText } from "@/lib/ui-copy";
import { money, date } from "@/lib/format";
import type { Store, Page, SalesReport } from "@/lib/types";
import {
  expenseCategories,
  expenseMethods,
  expenseInput,
  confirmedExpense,
  localExpenseDate,
  type StoreExpense,
  type ExpenseDraft,
  type ExpenseAudit,
} from "@/lib/store-expenses";
import { usePosCommand } from "./use-pos-command";
import { Modal, Loading, ErrorState, Empty, Pagination, Badge } from "./ui";

const names: Record<string, [string, string]> = {
  RENT: ["Rent", "Loyer"],
  UTILITIES: ["Utilities", "Eau et électricité"],
  SALARIES: ["Salaries", "Salaires"],
  SUPPLIES: ["Supplies", "Fournitures"],
  INVENTORY: ["Inventory purchases", "Achats de stock"],
  TRANSPORT: ["Transport", "Transport"],
  MARKETING: ["Marketing", "Marketing"],
  MAINTENANCE: ["Maintenance", "Entretien"],
  TAXES: ["Taxes", "Taxes"],
  OTHER: ["Other", "Autres"],
  CASH: ["Cash", "Espèces"],
  BANK_TRANSFER: ["Bank transfer", "Virement bancaire"],
  MOBILE_MONEY: ["Mobile money", "Mobile money"],
  CARD: ["Card", "Carte"],
};
export function ExpensesPanel({ store }: { store: Store }) {
  const { t } = useI18n();
  const { refresh } = useWorkspace();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("");
  const [voided, setVoided] = useState(false);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<{
    kind: "create" | "correct" | "void" | "history";
    expense?: StoreExpense;
  }>();
  const path = `/customer-api/commerce/stores/${store.id}/expenses`;
  const invalid = !!from && !!to && from > to;
  const query = new URLSearchParams({
    page: String(page),
    size: "20",
    includeVoided: String(voided),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(category ? { category } : {}),
  });
  const result = useQuery<
    Page<StoreExpense> & { totals: { currency: string; amount: number; count: number }[] }
  >(invalid ? null : `${path}?${query}`);
  function changed() {
    invalidateQueryPaths([path, `/customer-api/commerce/stores/${store.id}/reports`]);
    setAction(undefined);
  }
  const name = (key: string) => (names[key] ? t(...names[key]) : key);
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>{t("Expenses", "Dépenses")}</h2>
          <p className="muted">
            {t(
              "Track money paid out of your business.",
              "Suivez les dépenses payées par votre boutique.",
            )}
          </p>
        </div>
        <button className="button primary" onClick={() => setAction({ kind: "create" })}>
          <Plus size={17} />
          {t("Record expense", "Enregistrer une dépense")}
        </button>
      </div>
      <p className="muted small expense-intro">
        {t(
          "Record payments already made. This register does not send money. Fees and refunds already deducted from your sales should not be entered again.",
          "Enregistrez les paiements déjà effectués. Ce registre n’envoie pas d’argent. Ne ressaisissez pas les frais et remboursements déjà déduits de vos ventes.",
        )}
      </p>
      <div className="parity-filters inset">
        <label>
          {t("From", "Du")}
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          {t("To", "Au")}
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          {t("Category", "Catégorie")}
          <select
            aria-label={t("Category", "Catégorie")}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("All categories", "Toutes les catégories")}</option>
            {expenseCategories.map((c) => (
              <option key={c} value={c}>
                {name(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="expense-checkbox">
          <input
            type="checkbox"
            checked={voided}
            onChange={(e) => {
              setVoided(e.target.checked);
              setPage(0);
            }}
          />
          {t("Include cancelled expenses", "Inclure les dépenses annulées")}
        </label>
        <button className="text-button" onClick={refresh}>
          {t("Refresh", "Actualiser")}
        </button>
      </div>
      {invalid ? (
        <p role="alert" className="form-error inset">
          {t("Choose a valid date range.", "Choisissez une période valide.")}
        </p>
      ) : result.loading ? (
        <Loading />
      ) : result.error ? (
        <ErrorState message={result.error} retry={refresh} />
      ) : (
        result.data && (
          <>
            <div className="expense-totals">
              {result.data.totals?.map((v) => (
                <div key={v.currency}>
                  <small>
                    {t("Recorded expenses", "Dépenses enregistrées")} · {v.count}
                  </small>
                  <strong>{money(v.amount, v.currency)}</strong>
                </div>
              ))}
            </div>
            {!result.data.content.length ? (
              <Empty
                title={t("No expenses in this period", "Aucune dépense sur cette période")}
                description={t(
                  "Record rent, supplies, salaries and other business payments here.",
                  "Enregistrez ici le loyer, les fournitures, les salaires et les autres dépenses de la boutique.",
                )}
              />
            ) : (
              <div className="table-wrap expense-register">
                <table className="expense-register-table" aria-label={t("Expenses", "Dépenses")}>
                  <thead>
                    <tr>
                      <th scope="col">{t("Paid on", "Payé le")}</th>
                      <th scope="col">{t("Expense", "Dépense")}</th>
                      <th scope="col">{t("Amount paid", "Montant payé")}</th>
                      <th scope="col">{t("Payment method", "Moyen de paiement")}</th>
                      <th scope="col">{t("Status", "Statut")}</th>
                      <th scope="col">{t("Actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.content.map((e) => (
                      <tr key={e.id}>
                        <td data-label={t("Paid on", "Payé le")}>{e.paidOn}</td>
                        <td
                          data-label={t("Expense", "Dépense")}
                          className="expense-register-description"
                        >
                          <strong>{e.description}</strong>
                          <small>
                            {name(e.category)}
                            {e.payee ? ` · ${e.payee}` : ""}
                          </small>
                        </td>
                        <td
                          data-label={t("Amount paid", "Montant payé")}
                          className="expense-register-amount"
                        >
                          <strong>{money(e.amount, e.currency)}</strong>
                        </td>
                        <td data-label={t("Payment method", "Moyen de paiement")}>
                          {name(e.method)}
                          {e.reference && <small>{e.reference}</small>}
                        </td>
                        <td data-label={t("Status", "Statut")}>
                          {e.status === "VOIDED" ? (
                            <Badge value="VOIDED" />
                          ) : (
                            <span className="expense-recorded">{t("Recorded", "Enregistrée")}</span>
                          )}
                        </td>
                        <td
                          data-label={t("Actions", "Actions")}
                          className="expense-register-controls"
                        >
                          <div className="expense-actions">
                            <button
                              className="text-button"
                              onClick={() => setAction({ kind: "history", expense: e })}
                            >
                              <History size={15} />
                              {t("History", "Historique")}
                            </button>
                            {e.status === "RECORDED" && (
                              <>
                                <button
                                  className="text-button"
                                  onClick={() => setAction({ kind: "correct", expense: e })}
                                >
                                  <Pencil size={15} />
                                  {t("Correct", "Corriger")}
                                </button>
                                <button
                                  className="text-button danger-text"
                                  onClick={() => setAction({ kind: "void", expense: e })}
                                >
                                  <Ban size={15} />
                                  {t("Cancel", "Annuler")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              pages={result.data.totalPages}
              total={result.data.totalElements}
              onChange={setPage}
            />
          </>
        )
      )}
      {action?.kind === "history" && action.expense ? (
        <ExpenseHistory
          key={action.expense.id}
          path={`${path}/${action.expense.id}/history`}
          onClose={() => setAction(undefined)}
        />
      ) : (
        action && (
          <ExpenseEditor
            key={`${action.kind}:${action.expense?.id || "new"}`}
            store={store}
            kind={action.kind as "create" | "correct" | "void"}
            expense={action.expense}
            onClose={() => setAction(undefined)}
            onSaved={changed}
          />
        )
      )}
    </>
  );
}
function ExpenseEditor({
  store,
  kind,
  expense,
  onClose,
  onSaved,
}: {
  store: Store;
  kind: "create" | "correct" | "void";
  expense?: StoreExpense;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const path = `/customer-api/commerce/stores/${store.id}/expenses${expense ? `/${expense.id}/${kind === "void" ? "voids" : "corrections"}` : ""}`;
  const command = usePosCommand(path);
  const [draft, setDraft] = useState({
    amount: expense ? String(expense.amount) : "",
    currency: expense?.currency || store.defaultCurrency || "USD",
    paidOn: expense?.paidOn || localExpenseDate(),
    category: expense?.category || "OTHER",
    description: expense?.description || "",
    payee: expense?.payee || "",
    method: expense?.method || "CASH",
    reference: expense?.reference || "",
  });
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const set = (key: string, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const name = (key: string) => (names[key] ? t(...names[key]) : key);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      let body: object = {};
      if (!command.intent) {
        if (kind !== "create" && !reason.trim())
          throw new Error(
            t(
              "Explain why this expense is being changed.",
              "Expliquez pourquoi cette dépense est modifiée.",
            ),
          );
        const data =
          kind === "void"
            ? undefined
            : expenseInput(draft as Omit<ExpenseDraft, "amount"> & { amount: string });
        body =
          kind === "create"
            ? data!
            : kind === "void"
              ? { expectedVersion: expense!.version, reason: reason.trim() }
              : { expense: data, expectedVersion: expense!.version, reason: reason.trim() };
      }
      const result = await command.submit(body, (value) =>
        confirmedExpense(value, store.id, {
          id: expense?.id,
          status: kind === "void" ? "VOIDED" : "RECORDED",
        }),
      );
      if (result) onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Check the expense details.", "Vérifiez les détails de la dépense."),
      );
    }
  }
  const title =
    kind === "create"
      ? t("Record expense", "Enregistrer une dépense")
      : kind === "correct"
        ? t("Correct expense", "Corriger la dépense")
        : t("Cancel expense", "Annuler la dépense");
  return (
    <Modal title={title} onClose={onClose} busy={command.busy}>
      <form onSubmit={save} className="expense-form">
        {command.intent && (
          <p className="info-box" role="status">
            {t(
              "A saved request needs confirmation. Recover it before making another change.",
              "Une demande enregistrée doit être confirmée. Récupérez-la avant toute autre modification.",
            )}
          </p>
        )}
        <fieldset
          disabled={command.busy || !!command.intent || command.blocked}
          className="form-grid sale-update-fields"
        >
          {kind !== "void" ? (
            <>
              <label className="expense-wide">
                {t("Description", "Description")}
                <input
                  autoFocus
                  required
                  maxLength={500}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </label>
              <label>
                {t("Amount paid", "Montant payé")}
                <input
                  required
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => set("amount", e.target.value)}
                />
              </label>
              <label>
                {t("Currency", "Devise")}
                <input
                  required
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  value={draft.currency}
                  onChange={(e) => set("currency", e.target.value.toUpperCase())}
                />
              </label>
              <label>
                {t("Paid on", "Payé le")}
                <input
                  required
                  type="date"
                  max={localExpenseDate()}
                  value={draft.paidOn}
                  onChange={(e) => set("paidOn", e.target.value)}
                />
              </label>
              <label>
                {t("Category", "Catégorie")}
                <select
                  aria-label={t("Category", "Catégorie")}
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {expenseCategories.map((c) => (
                    <option value={c} key={c}>
                      {name(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("Payee (optional)", "Bénéficiaire (facultatif)")}
                <input
                  maxLength={200}
                  value={draft.payee}
                  onChange={(e) => set("payee", e.target.value)}
                />
              </label>
              <label>
                {t("Payment method", "Moyen de paiement")}
                <select
                  aria-label={t("Payment method", "Moyen de paiement")}
                  value={draft.method}
                  onChange={(e) => set("method", e.target.value)}
                >
                  {expenseMethods.map((c) => (
                    <option value={c} key={c}>
                      {name(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="expense-wide">
                {t("Reference (optional)", "Référence (facultative)")}
                <input
                  maxLength={128}
                  value={draft.reference}
                  onChange={(e) => set("reference", e.target.value)}
                />
              </label>
            </>
          ) : (
            <p className="expense-wide">
              {expense?.description} · {money(expense?.amount, expense?.currency)}
              <br />
              {t(
                "Cancellation excludes this entry from expense totals and keeps its history. It does not refund money.",
                "L’annulation exclut cette ligne des totaux et conserve son historique. Elle ne rembourse pas d’argent.",
              )}
            </p>
          )}
          {kind !== "create" && (
            <label className="expense-wide">
              {t("Reason", "Motif")}
              <textarea
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
        </fieldset>
        {(error || command.error) && (
          <p role="alert" className="form-error">
            {uiText(error || command.error!)}
          </p>
        )}
        <div className="parity-actions">
          <button
            className="button secondary"
            type="button"
            disabled={command.busy}
            onClick={onClose}
          >
            {t("Close", "Fermer")}
          </button>
          <button className="button primary" disabled={command.busy || command.blocked}>
            {command.busy
              ? t("Saving…", "Enregistrement…")
              : command.intent
                ? t("Recover saved request", "Récupérer la demande")
                : title}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ExpenseHistory({ path, onClose }: { path: string; onClose: () => void }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const history = useQuery<Page<ExpenseAudit>>(`${path}?page=${page}&size=20`);
  return (
    <Modal title={t("Expense history", "Historique de la dépense")} onClose={onClose}>
      {history.loading ? (
        <Loading />
      ) : history.error ? (
        <ErrorState message={history.error} retry={() => void history.refetch()} />
      ) : (
        history.data && (
          <>
            <div className="expense-history">
              {history.data.content.map((a) => (
                <article key={a.id}>
                  <strong>
                    {a.action === "CREATED"
                      ? t("Recorded", "Enregistrée")
                      : a.action === "CORRECTED"
                        ? t("Corrected", "Corrigée")
                        : t("Cancelled", "Annulée")}
                  </strong>
                  <p>
                    {date(a.createdAt)} · {a.actorName}
                  </p>
                  {a.reason && <p>{a.reason}</p>}
                  {a.before && (
                    <p>
                      {money(a.before.amount, a.before.currency)} · {a.before.paidOn} ·{" "}
                      {a.before.description} →
                    </p>
                  )}
                  <p>
                    {money(a.after.amount, a.after.currency)} · {a.after.paidOn} ·{" "}
                    {a.after.description}
                  </p>
                </article>
              ))}
            </div>
            <Pagination page={page} pages={history.data.totalPages} onChange={setPage} />
          </>
        )
      )}
    </Modal>
  );
}
export function ExpenseReportMetrics({ report: r }: { report: SalesReport }) {
  const { t } = useI18n();
  if (r.expensesAmount == null) return null;
  return (
    <section className="expense-report">
      <h3>{t("Expenses and performance", "Dépenses et performance")}</h3>
      <div className="report-grid">
        {[
          [t("Expenses paid", "Dépenses payées"), r.expensesAmount],
          [
            t("Sales proceeds less expenses", "Produit des ventes moins dépenses"),
            r.salesAfterExpensesAmount,
          ],
          [
            t("Receipts less expenses", "Encaissements moins dépenses"),
            r.receiptsAfterExpensesAmount,
          ],
        ].map(
          ([title, value]) =>
            value != null && (
              <div key={String(title)} className="report-metric">
                <small>{title}</small>
                <strong>{money(Number(value), r.currency)}</strong>
              </div>
            ),
        )}
      </div>
      <p className="muted small">
        {t(
          "Expenses follow their payment date. These figures cover recorded activity; they are not accounting profit or a wallet balance.",
          "Les dépenses suivent leur date de paiement. Ces chiffres couvrent l’activité enregistrée ; ce ne sont ni un bénéfice comptable ni un solde de portefeuille.",
        )}
      </p>
      {r.expensesByCategory?.map((c) => (
        <div className="detail-row" key={c.category}>
          <span>
            {names[c.category] ? t(...names[c.category]) : c.category} · {c.count}
          </span>
          <strong>{money(c.amount, r.currency)}</strong>
        </div>
      ))}
    </section>
  );
}
