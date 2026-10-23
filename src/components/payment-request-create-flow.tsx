"use client";
import { useState, useRef, useId } from "react";
import { Heart, ReceiptText, Zap, Plus, Pencil, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { useCurrencies } from "@/lib/use-currencies";
import { money, parseAmount, safeLink, label } from "@/lib/format";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { InvoiceItem, PaymentRequest } from "@/lib/types";
import {
  GuidedFlow,
  FlowField,
  FlowChoices,
  FlowReview,
  FlowError,
  useFlowDraft,
  type GuidedStep,
} from "./guided-flow";
import { MediaUpload } from "./media-upload";
import { Modal } from "./ui";
import { SettlementFields, type SettlementValue } from "./settlement-selector";
import { useWorkspace } from "./workspace-provider";
type RequestType = "QUICK_CHARGE" | "INVOICE" | "DONATION";
type Draft = {
  type: RequestType | "";
  title: string;
  description: string;
  amount: string;
  currency: string;
  images: string[];
  items: InvoiceItem[];
  allowPartial: boolean;
  feeInclusion: "ABSORBED" | "ON_TOP";
  settlement: SettlementValue | null;
};
export function PaymentRequestCreateFlow({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (payment: PaymentRequest) => void;
}) {
  const { t } = useI18n();
  const { refresh } = useWorkspace();
  const account = useQuery<{
    defaultFiatCurrency?: string;
    accountBalanceCurrency?: string;
    savingsEnabled?: boolean;
    serviceAccess?: { SAVINGS?: { enabled: boolean } };
  }>("/customer-api/accounts/my-account");
  const policy = useQuery<{ type: string; allowCustomSettlement: boolean }[]>(
    "/customer-api/payment_requests/type-settings",
  );
  const draft = useFlowDraft<Draft>(
    "request",
    {
      type: "",
      title: "",
      description: "",
      amount: "",
      currency: "",
      images: ["", "", "", ""],
      items: [],
      allowPartial: false,
      feeInclusion: "ABSORBED",
      settlement: null,
    },
    [
      "type",
      "title",
      "description",
      "amount",
      "currency",
      "images",
      "allowPartial",
      "feeInclusion",
    ],
  );
  const canDonate =
    account.data?.serviceAccess?.SAVINGS?.enabled ?? account.data?.savingsEnabled ?? false;
  const type: RequestType = ["QUICK_CHARGE", "INVOICE", "DONATION"].includes(draft.value.type)
    ? (draft.value.type as RequestType)
    : canDonate
      ? "DONATION"
      : "QUICK_CHARGE";
  const currency =
    draft.value.currency ||
    account.data?.defaultFiatCurrency ||
    account.data?.accountBalanceCurrency ||
    "USD";
  const currencies = useCurrencies([currency]);
  const [uploading, setUploading] = useState(false);
  const [changingSettlement, setChangingSettlement] = useState(false);
  const customSettlement =
    policy.data?.find((row) => row.type === type)?.allowCustomSettlement === true;
  const total = (v: Draft) =>
    Math.round(v.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) * 100) / 100;
  const amount = (v: Draft) =>
    type === "DONATION"
      ? null
      : v.amount.trim()
        ? parseAmount(v.amount, currency)
        : v.items.length && type === "INVOICE"
          ? total(v)
          : null;
  const typeStep: GuidedStep<Draft> = {
    id: "type",
    title: t("What would you like to create?", "Que souhaitez-vous créer ?"),
    helper: t(
      "Choose the collection that fits your goal.",
      "Choisissez l’encaissement adapté à votre objectif.",
    ),
    validate: () =>
      type === "DONATION" && !canDonate
        ? {
            type: t(
              "Choose an available request type.",
              "Choisissez un type de demande disponible.",
            ),
          }
        : {},
    render: ({ set }) => (
      <FlowChoices
        name="type"
        value={type}
        onChange={(next) => set({ type: next as RequestType, settlement: null })}
        choices={[
          ...(canDonate
            ? [
                {
                  value: "DONATION",
                  title: t("Donation / crowdfunding", "Don / financement participatif"),
                  description: t(
                    "Share a campaign and collect support.",
                    "Partagez une campagne et recevez du soutien.",
                  ),
                  icon: <Heart size={22} />,
                },
              ]
            : []),
          {
            value: "QUICK_CHARGE",
            title: t("Quick Charge", "Encaissement rapide"),
            description: t(
              "A simple link to collect an amount.",
              "Un lien simple pour encaisser un montant.",
            ),
            icon: <Zap size={22} />,
          },
          {
            value: "INVOICE",
            title: t("Invoice", "Facture"),
            description: t(
              "Bill a customer with items and payment terms.",
              "Facturez un client avec des articles et des conditions de paiement.",
            ),
            icon: <ReceiptText size={22} />,
          },
        ]}
      />
    ),
  };
  const amountStep: GuidedStep<Draft> = {
    id: "amount",
    title:
      type === "INVOICE"
        ? t("Amount and payment terms", "Montant et conditions")
        : t("How much will you collect?", "Quel montant souhaitez-vous encaisser ?"),
    helper:
      type === "INVOICE"
        ? t(
            "Leave the amount blank to use the item total, or allow a variable amount without items.",
            "Laissez le montant vide pour utiliser le total des articles, ou permettre un montant libre sans articles.",
          )
        : t(
            "Set the amount and currency for this payment link.",
            "Définissez le montant et la devise de ce lien de paiement.",
          ),
    validate: (v) => {
      if (type === "QUICK_CHARGE" && !v.amount.trim())
        return {
          amount: t("Enter an amount greater than zero.", "Saisissez un montant supérieur à zéro."),
        };
      try {
        if (v.amount.trim()) parseAmount(v.amount, currency);
        return {};
      } catch {
        return { amount: t("Enter a valid amount.", "Saisissez un montant valide.") };
      }
    },
    render: ({ value, set }) => (
      <>
        <FlowField
          name="amount"
          label={t("Amount", "Montant")}
          hint={
            type === "INVOICE" && value.items.length
              ? t("Item total: ", "Total des articles : ") + money(total(value), currency)
              : undefined
          }
        >
          <input
            inputMode="decimal"
            value={value.amount}
            onChange={(e) => set({ amount: e.target.value })}
          />
        </FlowField>
        <FlowField name="currency" label={t("Currency", "Devise")}>
          <select value={currency} onChange={(e) => set({ currency: e.target.value })}>
            {currencies.currencies.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </FlowField>
        {type === "INVOICE" && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={value.allowPartial}
              onChange={(e) => set({ allowPartial: e.target.checked })}
            />
            {t("Allow partial payments", "Autoriser les paiements partiels")}
          </label>
        )}
      </>
    ),
  };
  const settlementStep: GuidedStep<Draft> = {
    id: "settlement",
    title: t("Where will funds arrive?", "Où recevrez-vous les fonds ?"),
    helper: t(
      "Your Fondeka account balance is the default destination.",
      "Le solde de votre compte Fondeka est la destination par défaut.",
    ),
    validate: (v) =>
      v.settlement &&
      (!Number.isSafeInteger(v.settlement.paymentMethod.id) ||
        v.settlement.paymentMethod.id <= 0 ||
        !v.settlement.paymentMethod.accountRef.trim() ||
        (v.settlement.paymentMethod.networkId !== undefined &&
          (!Number.isSafeInteger(v.settlement.paymentMethod.networkId) ||
            v.settlement.paymentMethod.networkId <= 0)))
        ? {
            settlement: t(
              "Complete the selected settlement destination.",
              "Complétez la destination du règlement choisie.",
            ),
          }
        : {},
    render: ({ value, set }) => (
      <>
        <FlowReview title={t("Destination", "Destination")}>
          <p>
            <strong>
              {value.settlement
                ? value.settlement.paymentMethod.accountRef ||
                  t("External destination", "Destination externe")
                : t("Fondeka account balance", "Solde du compte Fondeka")}
            </strong>
          </p>
          <p>{value.settlement?.currency || currency}</p>
          {customSettlement && (
            <button
              type="button"
              className="text-button"
              onClick={() => setChangingSettlement((current) => !current)}
            >
              {t("Change", "Modifier")}
            </button>
          )}
        </FlowReview>
        {changingSettlement && customSettlement && (
          <div data-flow-field="settlement" tabIndex={-1}>
            <SettlementFields
              type={type}
              currency={currency}
              value={value.settlement}
              expanded
              onChange={(next) => set({ settlement: next as SettlementValue | null })}
            />
          </div>
        )}
        <FlowError name="settlement" />
        <FlowField name="feeInclusion" label={t("Processing fees", "Frais de traitement")}>
          <select
            value={value.feeInclusion}
            onChange={(e) => set({ feeInclusion: e.target.value as Draft["feeInclusion"] })}
          >
            <option value="ABSORBED">
              {t("I cover the fees", "Je prends les frais en charge")}
            </option>
            <option value="ON_TOP">
              {t("Add fees to the customer’s total", "Ajouter les frais au total du client")}
            </option>
          </select>
        </FlowField>
      </>
    ),
  };
  const review: GuidedStep<Draft> = {
    id: "review",
    title:
      type === "DONATION"
        ? t("Preview your campaign", "Aperçu de votre campagne")
        : t("Review your request", "Vérifiez votre demande"),
    helper: t(
      "Check the details before creating your link.",
      "Vérifiez les informations avant de créer votre lien.",
    ),
    render: ({ value, go }) => (
      <>
        {type === "DONATION" && safeLink(value.images[0]) && (
          <img className="flow-media-preview" src={safeLink(value.images[0])} alt={value.title} />
        )}
        <FlowReview
          title={label(type)}
          edit={() =>
            go(type === "QUICK_CHARGE" ? "amount" : type === "DONATION" ? "name" : "details")
          }
        >
          {type !== "QUICK_CHARGE" && (
            <p>
              <strong>{value.title || t("Invoice", "Facture")}</strong>
            </p>
          )}
          <p className="flow-price">
            {amount(value) == null
              ? t("Variable amount", "Montant libre")
              : money(amount(value), currency)}
          </p>
          {type !== "QUICK_CHARGE" && value.description && <p>{value.description}</p>}
        </FlowReview>
        {type === "INVOICE" && value.items.length > 0 && (
          <FlowReview title={t("Items", "Articles")} edit={() => go("items")}>
            {value.items.map((item, index) => (
              <div className="flow-row" key={index}>
                <span>
                  {item.name}
                  <small>
                    {item.quantity} × {money(item.unitPrice, currency)}
                  </small>
                </span>
                <strong>{money(item.unitPrice * item.quantity, currency)}</strong>
              </div>
            ))}
          </FlowReview>
        )}
        {type === "INVOICE" && (
          <FlowReview
            title={t("Payment terms", "Conditions de paiement")}
            edit={() => go("amount")}
          >
            <p>
              {value.allowPartial
                ? t("Partial payments allowed", "Paiements partiels autorisés")
                : t("Full payment", "Paiement intégral")}
            </p>
          </FlowReview>
        )}
        <FlowReview
          title={t("Settlement and fees", "Règlement et frais")}
          edit={() => go("settlement")}
        >
          <p>
            {value.settlement
              ? value.settlement.paymentMethod.accountRef
              : t("Fondeka account balance", "Solde du compte Fondeka")}
          </p>
          <p>
            {value.feeInclusion === "ABSORBED"
              ? t("I cover the fees", "Je prends les frais en charge")
              : t("Fees added to the customer’s total", "Frais ajoutés au total du client")}
          </p>
        </FlowReview>
      </>
    ),
  };
  const invoice: GuidedStep<Draft>[] = [
    {
      id: "details",
      title: t("Invoice details", "Détails de la facture"),
      helper: t(
        "Help your customer recognize this invoice.",
        "Aidez votre client à reconnaître cette facture.",
      ),
      render: ({ value, set }) => (
        <>
          <FlowField name="title" label={t("Invoice title", "Titre de la facture")}>
            <input
              maxLength={180}
              value={value.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </FlowField>
          <FlowField name="description" label={t("Description", "Description")}>
            <textarea
              value={value.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </FlowField>
        </>
      ),
    },
    {
      id: "items",
      title: t("Invoice items", "Articles de la facture"),
      helper: t(
        "Add the products or services you are billing for.",
        "Ajoutez les produits ou services à facturer.",
      ),
      validate: (v) =>
        v.items.some(
          (item) =>
            !item.name.trim() ||
            !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 ||
            !Number.isFinite(item.unitPrice) ||
            item.unitPrice <= 0,
        )
          ? { items: t("Complete each invoice item.", "Complétez chaque article de la facture.") }
          : {},
      render: ({ value, set }) => (
        <InvoiceItems
          items={value.items}
          currency={currency}
          onChange={(items) => set({ items })}
        />
      ),
    },
    amountStep,
  ];
  const campaign: GuidedStep<Draft>[] = [
    {
      id: "name",
      title: t("Campaign name", "Nom de la campagne"),
      helper: t(
        "Give your campaign a clear, recognizable name.",
        "Donnez à votre campagne un nom clair et reconnaissable.",
      ),
      validate: (v) =>
        v.title.trim().length < 3
          ? {
              title: t(
                "Enter a campaign name of at least 3 characters.",
                "Saisissez un nom de campagne d’au moins 3 caractères.",
              ),
            }
          : {},
      render: ({ value, set }) => (
        <FlowField name="title" label={t("Campaign name", "Nom de la campagne")}>
          <input
            value={value.title}
            maxLength={180}
            onChange={(e) => set({ title: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "cover",
      title: t("Campaign cover", "Image de couverture"),
      helper: t(
        "Choose the main image people will see.",
        "Choisissez l’image principale de votre campagne.",
      ),
      render: ({ value, set }) => (
        <MediaUpload
          label={t("Cover image", "Image de couverture")}
          value={value.images[0]}
          scope="payment-requests"
          onBusy={setUploading}
          disabled={uploading}
          onChange={(url) => set({ images: [url, ...value.images.slice(1)] })}
        />
      ),
    },
    {
      id: "images",
      title: t("Additional images", "Images supplémentaires"),
      helper: t(
        "Add up to three more photos, or continue without them.",
        "Ajoutez jusqu’à trois photos supplémentaires, ou continuez sans en ajouter.",
      ),
      render: ({ value, set }) => (
        <>
          {value.images.slice(1).map((url, index) => (
            <MediaUpload
              key={index}
              label={t("Photo ", "Photo ") + (index + 2)}
              value={url}
              scope="payment-requests"
              onBusy={setUploading}
              disabled={uploading}
              onChange={(next) =>
                set({ images: value.images.map((old, i) => (i === index + 1 ? next : old)) })
              }
            />
          ))}
        </>
      ),
    },
    {
      id: "story",
      title: t("Tell your story", "Racontez votre projet"),
      helper: t(
        "Explain what the campaign supports and why it matters.",
        "Expliquez l’objectif de la campagne et son importance.",
      ),
      render: ({ value, set }) => (
        <FlowField name="description" label={t("Campaign story", "Présentation de la campagne")}>
          <textarea
            rows={6}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "settings",
      title: t("Collection settings", "Paramètres de collecte"),
      helper: t(
        "Supporters choose their donation amount.",
        "Les participants choisissent le montant de leur don.",
      ),
      render: ({ set }) => (
        <>
          <FlowField name="currency" label={t("Collection currency", "Devise de collecte")}>
            <select value={currency} onChange={(e) => set({ currency: e.target.value })}>
              {currencies.currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </FlowField>
          <p className="muted">
            {t(
              "You can configure advanced collection options after creating the campaign.",
              "Vous pourrez configurer les options avancées après la création de la campagne.",
            )}
          </p>
        </>
      ),
    },
  ];
  const steps = [
    typeStep,
    ...(type === "QUICK_CHARGE" ? [amountStep] : type === "INVOICE" ? invoice : campaign),
    settlementStep,
    review,
  ];
  async function create() {
    const v = draft.value;
    const saved = await request<PaymentRequest>("/customer-api/payment_requests", {
      method: "POST",
      body: JSON.stringify({
        type,
        title: type === "QUICK_CHARGE" ? null : v.title.trim() || null,
        description: type === "QUICK_CHARGE" ? null : v.description.trim() || null,
        currency,
        amount: amount(v),
        feeInclusion: v.feeInclusion,
        allowPartial: type === "INVOICE" && v.allowPartial,
        minimumAmountEnabled: false,
        minAmount: null,
        maxAmount: null,
        goalAmount: null,
        showRecentPaymentsPublicly: null,
        payerFields: null,
        metadata: null,
        settlement: customSettlement ? v.settlement : null,
        ...Object.fromEntries(
          v.images.map((url, i) => ["image" + (i + 1), type === "DONATION" ? url || null : null]),
        ),
        items:
          type === "INVOICE"
            ? v.items.map((item) => ({
                ...item,
                name: item.name.trim(),
                description: item.description?.trim() || null,
                lineTotal: Math.round(item.quantity * item.unitPrice * 100) / 100,
              }))
            : [],
      }),
    });
    draft.clear();
    onCreated(saved);
    invalidateQueryPaths(["/customer-api/payment_requests"]);
  }
  return (
    <GuidedFlow
      id="request"
      title={t("Create a request", "Créer une demande")}
      steps={steps}
      value={draft.value}
      set={draft.set}
      dirty={draft.dirty}
      onDiscard={draft.clear}
      onClose={onClose}
      onFinish={create}
      finalLabel={
        type === "DONATION"
          ? t("Create campaign", "Créer la campagne")
          : t("Create request", "Créer la demande")
      }
      busy={uploading}
      loading={draft.restoring || account.loading || policy.loading || currencies.loading}
      dependencyError={account.error || policy.error || currencies.error}
      retry={refresh}
    />
  );
}
function InvoiceItems({
  items,
  currency,
  onChange,
}: {
  items: InvoiceItem[];
  currency: string;
  onChange: (items: InvoiceItem[]) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<{
    index: number;
    name: string;
    description: string;
    quantity: string;
    price: string;
  }>();
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const itemRoot = useRef<HTMLDivElement>(null);
  const itemErrorId = useId();
  function save() {
    if (!editing) return;
    try {
      if (!editing.name.trim()) {
        setInvalid("name");
        throw new Error(t("Enter an item name.", "Saisissez un nom d’article."));
      }
      if (!Number.isSafeInteger(Number(editing.quantity)) || Number(editing.quantity) < 1) {
        setInvalid("quantity");
        throw new Error(
          t("Enter a positive whole quantity.", "Saisissez une quantité entière positive."),
        );
      }
      setInvalid("price");
      const next = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        quantity: Number(editing.quantity),
        unitPrice: parseAmount(editing.price, currency),
      };
      onChange(
        editing.index < 0
          ? [...items, next]
          : items.map((old, i) => (i === editing.index ? next : old)),
      );
      setEditing(undefined);
      setError("");
      setInvalid("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : t("Check this item.", "Vérifiez cet article."),
      );
      requestAnimationFrame(() =>
        itemRoot.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
    }
  }
  return (
    <div data-flow-field="items" tabIndex={-1}>
      {items.map((item, index) => (
        <div className="flow-row" key={index}>
          <span>
            <strong>{item.name}</strong>
            <small>
              {item.quantity} × {money(item.unitPrice, currency)}
            </small>
          </span>
          <strong>{money(item.quantity * item.unitPrice, currency)}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Edit item", "Modifier l’article")}
            onClick={() => {
              setError("");
              setInvalid("");
              setEditing({
                index,
                name: item.name,
                description: item.description || "",
                quantity: String(item.quantity),
                price: String(item.unitPrice),
              });
            }}
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("Remove item", "Retirer l’article")}
            onClick={() => onChange(items.filter((_, i) => i !== index))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          setError("");
          setInvalid("");
          setEditing({ index: -1, name: "", description: "", quantity: "1", price: "" });
        }}
      >
        <Plus size={16} />
        {t("Add item", "Ajouter un article")}
      </button>
      <div className="flow-row">
        <span>{t("Item total", "Total des articles")}</span>
        <strong className="flow-price">
          {money(
            items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
            currency,
          )}
        </strong>
      </div>
      {editing && (
        <Modal
          title={t(
            editing.index < 0 ? "Add item" : "Edit item",
            editing.index < 0 ? "Ajouter un article" : "Modifier l’article",
          )}
          onClose={() => setEditing(undefined)}
        >
          <div
            ref={itemRoot}
            className="form-stack"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !(event.target instanceof HTMLTextAreaElement)) {
                event.preventDefault();
                event.stopPropagation();
                save();
              }
            }}
          >
            <label>
              {t("Item name", "Nom de l’article")}
              <input
                autoFocus
                data-autofocus
                name="invoiceItemName"
                aria-invalid={invalid === "name"}
                aria-describedby={invalid === "name" ? itemErrorId : undefined}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                {t("Quantity", "Quantité")}
                <input
                  type="number"
                  aria-invalid={invalid === "quantity"}
                  aria-describedby={invalid === "quantity" ? itemErrorId : undefined}
                  min={1}
                  step={1}
                  value={editing.quantity}
                  onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                />
              </label>
              <label>
                {t("Unit price", "Prix unitaire")}
                <input
                  inputMode="decimal"
                  aria-invalid={invalid === "price"}
                  aria-describedby={invalid === "price" ? itemErrorId : undefined}
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                />
              </label>
            </div>
            <label>
              {t("Description (optional)", "Description (facultatif)")}
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            {error && (
              <p role="alert" className="form-error" id={itemErrorId}>
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(undefined)}
              >
                {t("Back", "Retour")}
              </button>
              <button type="button" className="button primary" onClick={save}>
                {t("Save item", "Enregistrer l’article")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
