"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banknote, History, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { money, date, label } from "@/lib/format";
import { uiText } from "@/lib/ui-copy";
import { request } from "@/lib/data";
import { posOrderPath } from "@/lib/pos-payment";
import {
  confirmedOrder,
  decimalAmount,
  discountInput,
  hasPosFeature,
  saleActionAllowed,
  saleActionUnavailableReason,
  saleBalance,
  type CorrectionQuote,
} from "@/lib/pos-management";
import type { Order, Store } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";
import { usePosCommand } from "./use-pos-command";
import { DiscountFields, emptyDiscount, type DiscountDraft } from "./pos-discount";

export function SaleManagement({
  store,
  sale,
  onUpdated,
}: {
  store: Store;
  sale: Order;
  onUpdated: (order: Order) => void;
}) {
  const { t } = useI18n();
  const [action, setAction] = useState<"payment" | "correct" | "void">();
  const paymentCommand = usePosCommand(posOrderPath(store.id, sale.reference) + "/payments");
  const correctionCommand = usePosCommand(posOrderPath(store.id, sale.reference) + "/corrections");
  const voidCommand = usePosCommand(posOrderPath(store.id, sale.reference) + "/voids");
  const commands = { payment: paymentCommand, correct: correctionCommand, void: voidCommand };
  const pending = Object.values(commands).some(
    (command) => command.intent || command.blocked || command.busy,
  );
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  if (sale.channel !== "POS") return null;
  const balance = saleBalance(sale);
  const showPaymentAction = balance.amount !== 0 || Boolean(paymentCommand.intent);
  function unavailableReason(action: "payment" | "correct" | "void") {
    const reason = saleActionUnavailableReason(store, sale, action);
    if (!reason) return undefined;
    if (reason === "feature")
      return action === "payment"
        ? t(
            "Later payments are not enabled for this store yet.",
            "Les paiements ultérieurs ne sont pas encore activés pour cette boutique.",
          )
        : t(
            "Sale editing and deletion are not enabled for this store yet.",
            "La modification et la suppression des ventes ne sont pas encore activées pour cette boutique.",
          );
    return {
      permission: t(
        "Your store access does not allow changes to POS sales.",
        "Votre accès à la boutique ne permet pas de modifier les ventes POS.",
      ),
      voided: t(
        "This sale has already been cancelled or deleted.",
        "Cette vente a déjà été annulée ou supprimée.",
      ),
      provider: t(
        "Use the Fondeka payment and refund workflow for this sale.",
        "Utilisez la procédure de paiement et de remboursement Fondeka pour cette vente.",
      ),
      refresh: t(
        "Refresh the sale to check which changes are available.",
        "Actualisez la vente pour vérifier les modifications disponibles.",
      ),
      paid: t("This sale has no outstanding balance.", "Cette vente n’a aucun solde restant dû."),
      window: t(
        "The correction window for this sale has closed.",
        "Le délai de correction de cette vente est dépassé.",
      ),
      unavailable: t(
        "This action is not permitted for this sale.",
        "Cette action n’est pas autorisée pour cette vente.",
      ),
    }[reason];
  }
  return (
    <section className="sale-management">
      <div className="panel-heading">
        <h3>{t("Manage sale", "Gérer la vente")}</h3>
      </div>
      <div className="sale-balance-strip">
        <div>
          <small>{t("Recorded payments", "Paiements enregistrés")}</small>
          <strong>{money(sale.amountPaid, sale.amountPaidCurrency || sale.totalCurrency)}</strong>
        </div>
        <div>
          <small>{t("Still to collect", "Reste à encaisser")}</small>
          <strong>{money(balance.amount, balance.currency)}</strong>
        </div>
      </div>
      <div className="parity-actions">
        {showPaymentAction && (
          <div className="sale-action-option">
            <button
              className="button primary"
              disabled={
                !paymentCommand.intent && (pending || !saleActionAllowed(store, sale, "payment"))
              }
              aria-describedby={
                !paymentCommand.intent && unavailableReason("payment")
                  ? "sale-payment-unavailable"
                  : undefined
              }
              onClick={() => setAction("payment")}
            >
              <Banknote size={17} />
              {paymentCommand.intent
                ? t("Recover payment", "Récupérer le paiement")
                : t("Record a payment", "Enregistrer un paiement")}
            </button>
            {!paymentCommand.intent && unavailableReason("payment") && (
              <p id="sale-payment-unavailable" className="muted small">
                {unavailableReason("payment")}
              </p>
            )}
          </div>
        )}
        <div className="sale-action-option">
          <button
            className="button secondary"
            disabled={
              !correctionCommand.intent && (pending || !saleActionAllowed(store, sale, "correct"))
            }
            aria-describedby={
              !correctionCommand.intent && unavailableReason("correct")
                ? "sale-correction-unavailable"
                : undefined
            }
            onClick={() => setAction("correct")}
          >
            <Pencil size={16} />
            {correctionCommand.intent
              ? t("Recover correction", "Récupérer la correction")
              : t("Edit sale", "Modifier la vente")}
          </button>
          {!correctionCommand.intent && unavailableReason("correct") && (
            <p id="sale-correction-unavailable" className="muted small">
              {unavailableReason("correct")}
            </p>
          )}
        </div>
        <div className="sale-action-option">
          <button
            className="button secondary danger-text"
            disabled={!voidCommand.intent && (pending || !saleActionAllowed(store, sale, "void"))}
            aria-describedby={
              !voidCommand.intent && unavailableReason("void")
                ? "sale-deletion-unavailable"
                : undefined
            }
            onClick={() => setAction("void")}
          >
            <Trash2 size={16} />
            {voidCommand.intent
              ? t("Recover deletion", "Récupérer la suppression")
              : t("Delete sale", "Supprimer la vente")}
          </button>
          {!voidCommand.intent && unavailableReason("void") && (
            <p id="sale-deletion-unavailable" className="muted small">
              {unavailableReason("void")}
            </p>
          )}
        </div>
      </div>
      {Object.values(commands).some((command) => command.blocked) && (
        <p className="form-error" role="alert">
          {t(
            "A saved update needs support review before another change can be made.",
            "Une modification enregistrée nécessite une vérification de l’assistance avant tout nouveau changement.",
          )}
        </p>
      )}
      {hasPosFeature(store, "corrections") &&
        sale.posPaymentMode === "CASH" &&
        Number.isFinite(Date.parse(sale.posActions?.correctionAllowedUntil || "")) && (
          <p className="muted small">
            {t("Correction deadline: ", "Date limite de correction : ")}
            {date(sale.posActions!.correctionAllowedUntil!)}.
            {saleActionAllowed(store, sale, "payment") &&
              " " +
                t(
                  "Later payments can still be recorded when a balance remains due.",
                  "Les paiements ultérieurs restent possibles tant qu’un solde est dû.",
                )}
          </p>
        )}
      {sale.payments && (
        <>
          <h3>{t("Payment history", "Historique des paiements")}</h3>
          {!sale.payments.length && (
            <p className="muted">{t("No payment entries yet.", "Aucun paiement enregistré.")}</p>
          )}
          <ol className="sale-timeline">
            {sale.payments.map((payment) => (
              <li key={payment.id}>
                <div className="detail-row">
                  <strong>{money(payment.amount, payment.currency)}</strong>
                  <span>{label(payment.method)}</span>
                </div>
                <p>
                  {t("Received", "Reçu")} {date(payment.receivedAt)}
                </p>
                <small>
                  {t("Recorded by", "Enregistré par")} {payment.recordedBy} ·{" "}
                  {date(payment.recordedAt)}
                </small>
                {payment.reference && (
                  <p>
                    {t("Reference", "Référence")} : {payment.reference}
                  </p>
                )}
                {payment.note && <p>{payment.note}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
      {sale.auditTrail && (
        <details className="sale-audit">
          <summary>
            <History size={16} />
            {t("Sale activity", "Activité de la vente")} ({sale.auditTrail.length})
          </summary>
          <ol className="sale-timeline">
            {sale.auditTrail.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.summary}</strong>
                <p>{entry.reason}</p>
                <small>
                  {entry.actorName} · {date(entry.createdAt)}
                </small>
              </li>
            ))}
          </ol>
        </details>
      )}
      {action && (
        <SaleUpdateDialog
          key={sale.reference + action}
          action={action}
          command={commands[action]}
          sale={sale}
          store={store}
          onClose={() => setAction(undefined)}
          onUpdated={(order) => {
            commands[action].resetCompleted();
            onUpdated(order);
            setAction(undefined);
          }}
        />
      )}
    </section>
  );
}

function SaleUpdateDialog({
  action,
  command,
  sale,
  store,
  onClose,
  onUpdated,
}: {
  action: "payment" | "correct" | "void";
  command: ReturnType<typeof usePosCommand>;
  sale: Order;
  store: Store;
  onClose: () => void;
  onUpdated: (order: Order) => void;
}) {
  const { t } = useI18n();
  const suffix = { payment: "payments", correct: "corrections", void: "voids" }[action];
  const path = posOrderPath(store.id, sale.reference) + "/" + suffix;
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState("RESTOCK");
  const [acknowledged, setAcknowledged] = useState(false);
  const [items, setItems] = useState(() =>
    (sale.items || []).map((item) => ({
      productId: item.productId,
      quantity: String(item.quantity),
      name: item.productName,
    })),
  );
  const [buyerName, setBuyerName] = useState(sale.buyerName || "");
  const [due, setDue] = useState(sale.paymentDueDate || "");
  const [discount, setDiscount] = useState<DiscountDraft>(
    sale.discount
      ? { enabled: true, ...sale.discount, value: String(sale.discount.value) }
      : emptyDiscount,
  );
  const [quote, setQuote] = useState<CorrectionQuote>();
  const [quotedBody, setQuotedBody] = useState<object>();
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const frozen = command.busy || !!command.intent || command.blocked || quoting;
  const balance = saleBalance(sale);
  function changed() {
    setQuote(undefined);
    setQuotedBody(undefined);
    setError("");
  }
  const saved = command.intent
    ? (JSON.parse(command.intent.body) as Record<string, unknown>)
    : undefined;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || command.busy || command.blocked) return;
    setError("");
    lock.current = true;
    try {
      let body: object;
      if (command.intent)
        body = {}; // The recovery client always sends the saved, immutable body.
      else {
        if (!saleActionAllowed(store, sale, action))
          throw new Error(
            t(
              "This update is no longer allowed. Refresh the sale.",
              "Cette modification n’est plus autorisée. Actualisez la vente.",
            ),
          );
        if (action === "payment") {
          const value = decimalAmount(amount, balance.currency);
          if (value > balance.amount!)
            throw new Error(
              t(
                "The payment cannot exceed the balance due.",
                "Le paiement ne peut pas dépasser le solde dû.",
              ),
            );
          const received = new Date(receivedAt);
          if (
            !Number.isFinite(received.getTime()) ||
            received.getTime() > Date.now() + 60000 ||
            received.getTime() < Date.parse(sale.createdAt)
          )
            throw new Error(
              t(
                "Choose a receipt time between the sale and now.",
                "Choisissez une date de réception entre la vente et maintenant.",
              ),
            );
          if (method !== "CASH" && !reference.trim())
            throw new Error(
              t(
                "Enter the external payment reference.",
                "Saisissez la référence du paiement externe.",
              ),
            );
          if (!acknowledged)
            throw new Error(
              t("Confirm that you received this payment.", "Confirmez avoir reçu ce paiement."),
            );
          body = {
            expectedVersion: sale.version,
            amount: value,
            currency: balance.currency,
            method,
            receivedAt: received.toISOString(),
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
          };
        } else {
          if (!reason.trim())
            throw new Error(
              t("Enter a reason for this change.", "Saisissez le motif de cette modification."),
            );
          if (action === "void") {
            if (!acknowledged)
              throw new Error(
                t(
                  "Confirm the deletion and refund information.",
                  "Confirmez la suppression et les informations de remboursement.",
                ),
              );
            body = {
              expectedVersion: sale.version,
              reason: reason.trim(),
              inventoryDisposition: restock,
            };
          } else {
            const nextItems = items
              .filter((item) => item.quantity !== "0")
              .map((item) => {
                if (
                  !item.productId ||
                  !/^\d+$/.test(item.quantity) ||
                  Number(item.quantity) < 1 ||
                  !Number.isSafeInteger(Number(item.quantity))
                )
                  throw new Error(
                    t(
                      "Use whole quantities, or 0 to remove an item.",
                      "Utilisez des quantités entières, ou 0 pour retirer un article.",
                    ),
                  );
                return { productId: item.productId, quantity: Number(item.quantity) };
              });
            if (!nextItems.length)
              throw new Error(
                t(
                  "Keep at least one item, or delete the sale.",
                  "Conservez au moins un article, ou supprimez la vente.",
                ),
              );
            if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))
              throw new Error(t("Choose a valid due date.", "Choisissez une échéance valide."));
            const draft = {
              expectedVersion: sale.version,
              items: nextItems,
              buyerName: buyerName.trim(),
              paymentDueDate: due || null,
              discount: discount.enabled
                ? discountInput(
                    discount.type,
                    discount.value,
                    discount.reason,
                    sale.discount?.currency || sale.totalCurrency,
                  )
                : null,
              reason: reason.trim(),
            };
            if (!quote) {
              setQuoting(true);
              const result = await request<CorrectionQuote>(path + "/quote", {
                method: "POST",
                body: JSON.stringify(draft),
              });
              if (
                !result.quoteId ||
                result.orderVersion !== sale.version ||
                !Number.isFinite(result.totalAmount) ||
                result.totalAmount <= 0 ||
                result.totalCurrency !== sale.totalCurrency ||
                !Number.isFinite(result.amountPaid) ||
                result.amountPaid < 0 ||
                !Number.isFinite(result.balanceDue) ||
                result.balanceDue < 0 ||
                !Number.isFinite(result.refundRequiredAmount) ||
                result.refundRequiredAmount < 0 ||
                !Number.isFinite(Date.parse(result.expiresAt || "")) ||
                Date.parse(result.expiresAt!) <= Date.now()
              )
                throw new Error(
                  t(
                    "The correction quote could not be verified.",
                    "Le devis de correction n’a pas pu être vérifié.",
                  ),
                );
              setQuote(result);
              setQuotedBody(draft);
              return;
            }
            if (!quotedBody || Date.parse(quote.expiresAt || "") <= Date.now()) {
              changed();
              throw new Error(
                t(
                  "This preview expired. Calculate the correction again.",
                  "Cet aperçu a expiré. Recalculez la correction.",
                ),
              );
            }
            if (quote.refundRequiredAmount > 0)
              throw new Error(
                t(
                  "Resolve the required refund before correcting this sale.",
                  "Résolvez le remboursement requis avant de corriger cette vente.",
                ),
              );
            body = { ...quotedBody, quoteId: quote.quoteId };
          }
        }
      }
      const order = await command.submit(body, (value) =>
        confirmedOrder(
          value,
          store.id,
          sale.reference,
          Number(command.intent ? JSON.parse(command.intent.body).expectedVersion : sale.version),
        ),
      );
      if (order) onUpdated(order);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? uiText(failure.message)
          : t("Unable to update sale.", "Impossible de modifier la vente."),
      );
    } finally {
      setQuoting(false);
      lock.current = false;
    }
  }
  return (
    <Modal
      title={
        action === "payment"
          ? t("Record a payment", "Enregistrer un paiement")
          : action === "correct"
            ? t("Correct sale", "Corriger la vente")
            : t("Delete sale", "Supprimer la vente")
      }
      description={sale.reference}
      onClose={onClose}
      busy={command.busy || quoting}
      className="owner-detail-dialog"
    >
      <form className="form-stack" onSubmit={submit}>
        {command.intent && (
          <div className="info-box" role="status">
            <strong>
              {t("An update needs confirmation", "Une modification doit être confirmée")}
            </strong>
            <p>
              {t(
                "Retry the saved request to recover its result. Its amount and reference will stay unchanged.",
                "Réessayez la demande enregistrée pour récupérer son résultat. Son montant et sa référence restent identiques.",
              )}
            </p>
            {action === "payment" && (
              <p>
                <strong>{money(Number(saved?.amount), String(saved?.currency))}</strong>
                {saved?.reference ? ` · ${String(saved.reference)}` : ""}
              </p>
            )}
            {saved?.reason ? <p>{String(saved.reason)}</p> : null}
          </div>
        )}
        <fieldset
          disabled={frozen}
          hidden={!!command.intent}
          className="form-stack sale-update-fields"
        >
          {action === "payment" ? (
            <>
              <div className="sale-balance-strip">
                <div>
                  <small>{t("Balance due", "Solde dû")}</small>
                  <strong>{money(balance.amount, balance.currency)}</strong>
                </div>
              </div>
              <label>
                {t("Amount received", "Montant reçu")} ({balance.currency})
                <input
                  data-autofocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required={!command.intent}
                />
              </label>
              <button
                className="text-button"
                type="button"
                onClick={() => setAmount(String(balance.amount))}
              >
                {t("Use full balance", "Utiliser le solde total")}
              </button>
              <div className="form-grid">
                <label>
                  {t("Payment method", "Moyen de paiement")}
                  <select value={method} onChange={(e) => setMethod(e.target.value)}>
                    {["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"].map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Received on", "Reçu le")}
                  <input
                    type="datetime-local"
                    value={receivedAt}
                    onChange={(e) => setReceivedAt(e.target.value)}
                    required
                  />
                </label>
              </div>
              <label>
                {t("Payment reference", "Référence du paiement")}
                <input
                  value={reference}
                  maxLength={128}
                  onChange={(e) => setReference(e.target.value)}
                  required={method !== "CASH"}
                />
              </label>
              <label>
                {t("Note (optional)", "Note (facultative)")}
                <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="muted small">
                {t(
                  "This records money already received outside Fondeka. Each payment keeps its own date, method, reference and staff member.",
                  "Ce formulaire enregistre de l’argent déjà reçu hors Fondeka. Chaque paiement conserve sa date, son moyen, sa référence et le membre de l’équipe.",
                )}
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                {t(
                  "I confirm this payment has been received.",
                  "Je confirme avoir reçu ce paiement.",
                )}
              </label>
            </>
          ) : (
            <>
              {action === "correct" ? (
                <>
                  <p className="muted">
                    {t(
                      "Adjust quantities and sale details. Payments remain in their own history.",
                      "Ajustez les quantités et les détails. Les paiements conservent leur historique.",
                    )}
                  </p>
                  {items.map((item, index) => (
                    <label className="sale-quantity-row" key={item.productId || index}>
                      <span>{item.name}</span>
                      <input
                        aria-label={t("Quantity for ", "Quantité pour ") + item.name}
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => {
                          changed();
                          setItems(
                            items.map((row, i) =>
                              i === index ? { ...row, quantity: e.target.value } : row,
                            ),
                          );
                        }}
                      />
                    </label>
                  ))}
                  <p className="muted small">
                    {t(
                      "Set quantity to 0 to remove an item.",
                      "Utilisez 0 pour retirer un article.",
                    )}
                  </p>
                  <label>
                    {t("Customer name", "Nom du client")}
                    <input
                      value={buyerName}
                      maxLength={180}
                      onChange={(e) => {
                        changed();
                        setBuyerName(e.target.value);
                      }}
                    />
                  </label>
                  <label>
                    {t("Payment due date", "Date d’échéance")}
                    <input
                      type="date"
                      value={due}
                      onChange={(e) => {
                        changed();
                        setDue(e.target.value);
                      }}
                    />
                  </label>
                  <DiscountFields
                    value={discount}
                    onChange={(value) => {
                      changed();
                      setDiscount(value);
                    }}
                    currency={sale.discount?.currency || sale.totalCurrency}
                    available={hasPosFeature(store, "discounts")}
                  />
                </>
              ) : (
                <div className="info-box">
                  <strong>{t("This sale will be voided", "Cette vente sera annulée")}</strong>
                  <p>
                    {t(
                      "Its original details, payments and deletion reason remain in the audit history. Voiding a sale does not refund money automatically.",
                      "Ses détails initiaux, paiements et motif restent dans l’historique. L’annulation ne rembourse pas automatiquement l’argent.",
                    )}
                  </p>
                </div>
              )}
              <label>
                {t("Reason", "Motif")}
                <textarea
                  data-autofocus={action === "void" ? true : undefined}
                  value={reason}
                  maxLength={500}
                  onChange={(e) => {
                    changed();
                    setReason(e.target.value);
                  }}
                  required
                />
              </label>
              {action === "void" && (
                <>
                  <label>
                    {t("Inventory", "Stock")}
                    <select value={restock} onChange={(e) => setRestock(e.target.value)}>
                      <option value="RESTOCK">
                        {t("Return items to stock", "Remettre les articles en stock")}
                      </option>
                      <option value="DO_NOT_RESTOCK">
                        {t("Do not return items to stock", "Ne pas remettre les articles en stock")}
                      </option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    {t(
                      "I confirm the deletion and will handle any refund separately.",
                      "Je confirme la suppression et traiterai séparément tout remboursement.",
                    )}
                  </label>
                </>
              )}
            </>
          )}
        </fieldset>
        {quote && (
          <div className="correction-preview" aria-live="polite">
            <h3>{t("Correction preview", "Aperçu de la correction")}</h3>
            <div className="detail-row">
              <span>{t("Revised total", "Nouveau total")}</span>
              <strong>{money(quote.totalAmount, quote.totalCurrency)}</strong>
            </div>
            <div className="detail-row">
              <span>{t("Payments retained", "Paiements conservés")}</span>
              <strong>{money(quote.amountPaid, quote.totalCurrency)}</strong>
            </div>
            <div className="detail-row">
              <span>{t("New balance due", "Nouveau solde dû")}</span>
              <strong>{money(quote.balanceDue, quote.totalCurrency)}</strong>
            </div>
            {quote.refundRequiredAmount > 0 && (
              <p className="form-error" role="alert">
                {t(
                  "Refund required before saving: ",
                  "Remboursement requis avant enregistrement : ",
                )}
                {money(quote.refundRequiredAmount, quote.totalCurrency)}
              </p>
            )}
          </div>
        )}
        {(error || command.error) && (
          <p className="form-error" role="alert">
            {error || uiText(command.error!)}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={command.busy || quoting}
            onClick={onClose}
          >
            {t("Close", "Fermer")}
          </button>
          <SubmitButton
            busy={command.busy || quoting}
            disabled={
              command.blocked ||
              (!command.intent && action === "correct" && !!quote && quote.refundRequiredAmount > 0)
            }
          >
            {command.intent
              ? t("Retry saved update", "Réessayer la modification")
              : action === "payment"
                ? t("Save payment", "Enregistrer le paiement")
                : action === "correct"
                  ? quote
                    ? t("Save correction", "Enregistrer la correction")
                    : t("Preview correction", "Vérifier la correction")
                  : t("Confirm deletion", "Confirmer la suppression")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
