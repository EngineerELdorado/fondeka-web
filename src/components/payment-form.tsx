"use client";
import { useRef, useState, type FormEvent } from "react";
import { useCurrencies } from "@/lib/use-currencies";
import { useI18n } from "@/lib/i18n";
import { parseAmount } from "@/lib/format";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { useQuery } from "@/lib/use-query";
import { SettlementFields } from "./settlement-selector";
import { normalizePayerFields } from "@/lib/commerce";
import { uiText } from "@/lib/ui-copy";
import type { PaymentRequest, PayerField, InvoiceItem } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";
import { MediaUpload } from "./media-upload";
import { useWorkspace } from "./workspace-provider";
import { PaymentRequestCreateFlow } from "./payment-request-create-flow";
type PaymentFormProps = {
  payment?: PaymentRequest;
  onClose: () => void;
  onCreated: (payment: PaymentRequest) => void;
};
export function PaymentForm(props: PaymentFormProps) {
  return props.payment ? (
    <PaymentEditor {...props} />
  ) : (
    <PaymentRequestCreateFlow onClose={props.onClose} onCreated={props.onCreated} />
  );
}
function PaymentEditor({
  payment,
  onClose,
  onCreated,
}: {
  payment?: PaymentRequest;
  onClose: () => void;
  onCreated: (payment: PaymentRequest) => void;
}) {
  const { t } = useI18n();
  const { notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState(payment?.type || "QUICK_CHARGE");
  const account = useQuery<{ defaultFiatCurrency?: string }>("/customer-api/accounts/my-account");
  const [chosenCurrency, setCurrency] = useState("");
  const currency =
    chosenCurrency || payment?.currency || account.data?.defaultFiatCurrency || "USD";
  const { currencies } = useCurrencies([currency]);
  const [images, setImages] = useState([
    payment?.image1 || "",
    payment?.image2 || "",
    payment?.image3 || "",
    payment?.image4 || "",
  ]);
  const [items, setItems] = useState<InvoiceItem[]>(payment?.items || []);
  const [fields, setFields] = useState<PayerField[]>(payment?.payerFields || []);
  const [settlement, setSettlement] = useState<unknown>(
    payment?.settlement
      ? {
          paymentMethod: {
            id: payment.settlement.paymentMethodId,
            networkId: payment.settlement.networkId,
            accountRef: payment.settlement.accountRef,
          },
          currency: payment.settlement.currency,
        }
      : null,
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || uploading) return;
    const f = new FormData(e.currentTarget);
    setError("");
    try {
      const payerFields = normalizePayerFields(fields);
      const amount =
        type === "DONATION"
          ? null
          : f.get("amount")
            ? parseAmount(String(f.get("amount")), currency)
            : null;
      if (type === "QUICK_CHARGE" && !amount)
        throw new Error(
          t("Enter an amount greater than zero.", "Saisissez un montant supérieur à zéro."),
        );
      if (
        items.some(
          (i) =>
            !i.name.trim() ||
            !Number.isInteger(i.quantity) ||
            i.quantity < 1 ||
            !Number.isFinite(i.unitPrice) ||
            i.unitPrice <= 0,
        )
      )
        throw new Error(
          t("Complete each invoice item.", "Complétez chaque article de la facture."),
        );
      if (
        fields.some((i) => !i.label.trim()) ||
        new Set(fields.map((i) => i.key)).size !== fields.length
      )
        throw new Error(
          t(
            "Give each payer field a unique name.",
            "Donnez un nom unique à chaque champ du payeur.",
          ),
        );
      lock.current = true;
      setBusy(true);
      const body = {
        type,
        title: String(f.get("title")).trim(),
        description: String(f.get("description")).trim(),
        currency,
        amount:
          amount ??
          (type === "INVOICE" && items.length
            ? Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100
            : null),
        feeInclusion: String(f.get("feeInclusion")),
        allowPartial: type === "INVOICE" && f.get("allowPartial") === "on",
        minimumAmountEnabled: type === "DONATION" && f.get("minimumAmountEnabled") === "on",
        minAmount:
          type === "DONATION" && f.get("minimumAmountEnabled") === "on"
            ? parseAmount(String(f.get("minAmount")), currency)
            : null,
        maxAmount: payment?.maxAmount ?? null,
        goalAmount: payment?.goalAmount ?? null,
        showRecentPaymentsPublicly:
          type === "DONATION" && f.get("showRecentPaymentsPublicly") === "on",
        ...Object.fromEntries(images.map((image, i) => [`image${i + 1}`, image || null])),
        metadata: {
          ...payment?.metadata,
          youtubeUrl: String(f.get("youtubeUrl") || "").trim() || null,
        },
        payerFields,
        items:
          type === "INVOICE"
            ? items.map((i) => ({
                name: i.name.trim(),
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                description: i.description || null,
                lineTotal: Math.round(i.quantity * i.unitPrice * 100) / 100,
              }))
            : [],
        settlement,
      };
      const saved = await request<PaymentRequest>(
        `/customer-api/payment_requests${payment ? `/${payment.id}` : ""}`,
        { method: payment ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      invalidateQueryPaths(["/customer-api/payment_requests"]);
      notify(
        t(
          payment ? "Request updated." : "Request created.",
          payment ? "Demande modifiée." : "Demande créée.",
        ),
      );
      onCreated(saved);
    } catch (e) {
      setError(
        e instanceof Error
          ? uiText(e.message)
          : t("Unable to save this request.", "Impossible d’enregistrer cette demande."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t(
        payment ? "Edit request" : "Create request",
        payment ? "Modifier la demande" : "Créer une demande",
      )}
      onClose={onClose}
      busy={busy || uploading}
      className="owner-form-dialog"
    >
      <form className="form-stack" onSubmit={submit}>
        <label>
          {t("Request type", "Type de demande")}
          <select
            value={type}
            disabled={!!payment}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            <option value="QUICK_CHARGE">{t("Quick Charge", "Encaissement rapide")}</option>
            <option value="INVOICE">{t("Invoice", "Facture")}</option>
            <option value="DONATION">
              {t("Donation / crowdfunding", "Don / financement participatif")}
            </option>
          </select>
        </label>
        <label>
          {t("Title", "Titre")}
          <input
            name="title"
            defaultValue={payment?.title}
            maxLength={180}
            required={type === "DONATION"}
            minLength={type === "DONATION" ? 3 : undefined}
            autoFocus
          />
        </label>
        <label>
          {t("Description", "Description")}
          <textarea name="description" defaultValue={payment?.description} rows={3} />
        </label>
        <div className="form-grid">
          {type !== "DONATION" && (
            <label>
              {t("Amount", "Montant")}
              <input
                name="amount"
                defaultValue={payment?.amount ?? ""}
                inputMode="decimal"
                required={type === "QUICK_CHARGE"}
              />
              {type === "INVOICE" && (
                <span className="muted">
                  {t(
                    "Leave blank to use the item total, or let the payer choose when there are no items.",
                    "Laissez vide pour utiliser le total des articles, ou laisser le payeur choisir en l’absence d’articles.",
                  )}
                </span>
              )}
            </label>
          )}
          <label>
            {t("Currency", "Devise")}
            <select
              value={currency}
              disabled={!!payment}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {type === "INVOICE" && (
          <section className="form-section">
            <h3>{t("Invoice items", "Articles de la facture")}</h3>
            {items.map((item, i) => (
              <div className="invoice-item" key={i}>
                <label>
                  {t("Item", "Article")}
                  <input
                    value={item.name}
                    onChange={(e) =>
                      setItems(items.map((v, j) => (i === j ? { ...v, name: e.target.value } : v)))
                    }
                    required
                  />
                </label>
                <label>
                  {t("Quantity", "Quantité")}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) =>
                      setItems(
                        items.map((v, j) =>
                          i === j ? { ...v, quantity: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {t("Unit price", "Prix unitaire")}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) =>
                      setItems(
                        items.map((v, j) =>
                          i === j ? { ...v, unitPrice: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  />
                </label>
                <label className="invoice-item-description">
                  {t("Description", "Description")}
                  <input
                    value={item.description || ""}
                    onChange={(e) =>
                      setItems(
                        items.map((v, j) => (i === j ? { ...v, description: e.target.value } : v)),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}
                >
                  {t("Remove", "Retirer")}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button secondary small"
              onClick={() => setItems([...items, { name: "", quantity: 1, unitPrice: 0 }])}
            >
              {t("Add item", "Ajouter un article")}
            </button>
            <label className="checkbox-label">
              <input name="allowPartial" type="checkbox" defaultChecked={payment?.allowPartial} />
              {t("Allow partial payments", "Autoriser les paiements partiels")}
            </label>
          </section>
        )}
        {type === "DONATION" && (
          <section className="form-section">
            <p>
              {t(
                "Customers choose their donation amount.",
                "Les clients choisissent le montant de leur don.",
              )}
            </p>
            <label className="checkbox-label">
              <input
                name="minimumAmountEnabled"
                type="checkbox"
                defaultChecked={payment?.minimumAmountEnabled}
              />
              {t("Set a minimum donation", "Définir un don minimum")}
            </label>
            <label>
              {t("Minimum amount", "Montant minimum")}
              <input name="minAmount" defaultValue={payment?.minAmount ?? ""} inputMode="decimal" />
            </label>
            <label className="checkbox-label">
              <input
                name="showRecentPaymentsPublicly"
                type="checkbox"
                defaultChecked={payment?.showRecentPaymentsPublicly}
              />
              {t("Show recent donations publicly", "Afficher les dons récents publiquement")}
            </label>
            {images.map((image, i) => (
              <MediaUpload
                disabled={uploading}
                key={i}
                label={`${t("Photo", "Photo")} ${i + 1}`}
                value={image}
                scope="payment-requests"
                onBusy={setUploading}
                onChange={(v) => setImages(images.map((p, j) => (j === i ? v : p)))}
              />
            ))}
            <label>
              {t("YouTube video URL", "Lien vidéo YouTube")}
              <input
                type="url"
                name="youtubeUrl"
                defaultValue={String(payment?.metadata?.youtubeUrl || "")}
              />
            </label>
          </section>
        )}
        <section className="form-section">
          <h3>{t("Payer details", "Informations du payeur")}</h3>
          {fields.map((field, i) => (
            <div className="payer-field" key={i}>
              <label>
                {t("Field label", "Libellé du champ")}
                <input
                  required
                  value={field.label}
                  onChange={(e) =>
                    setFields(fields.map((v, j) => (i === j ? { ...v, label: e.target.value } : v)))
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    setFields(
                      fields.map((v, j) => (i === j ? { ...v, required: e.target.checked } : v)),
                    )
                  }
                />
                {t("Required", "Obligatoire")}
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() => setFields(fields.filter((_, j) => j !== i))}
              >
                {t("Remove", "Retirer")}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary small"
            onClick={() =>
              setFields([
                ...fields,
                { key: `field_${crypto.randomUUID().slice(0, 8)}`, label: "", required: false },
              ])
            }
          >
            {t("Add field", "Ajouter un champ")}
          </button>
        </section>
        <label>
          {t("Processing fees", "Frais de traitement")}
          <select
            name="feeInclusion"
            defaultValue={payment?.feeInclusion || "ABSORBED"}
            disabled={!!payment}
          >
            <option value="ABSORBED">
              {t("I cover the fees", "Je prends les frais en charge")}
            </option>
            <option value="ON_TOP">
              {t("Add fees to the customer’s total", "Ajouter les frais au total du client")}
            </option>
          </select>
        </label>
        {!!payment && (
          <input type="hidden" name="feeInclusion" value={payment.feeInclusion || "ABSORBED"} />
        )}
        <SettlementFields
          type={type}
          currency={currency}
          onChange={setSettlement}
          existing={payment?.settlement}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading}
            onClick={onClose}
          >
            {t("Cancel", "Annuler")}
          </button>
          <SubmitButton busy={busy} disabled={uploading}>
            {t(payment ? "Save" : "Create request", payment ? "Enregistrer" : "Créer une demande")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
