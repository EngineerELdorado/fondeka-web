"use client";
import { useState } from "react";
import { Package, Download, CalendarDays, BookOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCurrencies } from "@/lib/use-currencies";
import { money, parseAmount, label, safeLink } from "@/lib/format";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Product, Store } from "@/lib/types";
import { MediaUpload } from "./media-upload";
import { useWorkspace } from "./workspace-provider";
import {
  GuidedFlow,
  FlowField,
  FlowChoices,
  FlowReview,
  useFlowDraft,
  type GuidedStep,
} from "./guided-flow";
import { ProductFeeMode } from "./product-fee-mode";
type Draft = {
  feeApplicationMode: "INHERIT" | "EXCLUSIVE" | "INCLUSIVE";
  name: string;
  price: string;
  currency: string;
  images: string[];
  video: string;
  duration: number;
  description: string;
  type: "PHYSICAL" | "DIGITAL" | "SERVICE" | "TRAINING";
  stock: string;
  fulfillmentUrl: string;
  instructions: string;
  asset: string;
};
export function ProductCreateFlow({
  store,
  onClose,
  onSaved,
}: {
  store: Store;
  onClose: () => void;
  onSaved?: (product: Product) => void;
}) {
  const { t } = useI18n();
  const { notify, refresh } = useWorkspace();
  const draft = useFlowDraft<Draft>(
    "product:" + store.id,
    {
      name: "",
      price: "",
      feeApplicationMode: "INHERIT",
      currency: store.defaultCurrency,
      images: ["", "", "", ""],
      video: "",
      duration: 0,
      description: "",
      type: "PHYSICAL",
      stock: "0",
      fulfillmentUrl: "",
      instructions: "",
      asset: "",
    },
    [
      "name",
      "price",
      "feeApplicationMode",
      "currency",
      "images",
      "video",
      "duration",
      "description",
      "type",
      "stock",
    ],
  );
  const [uploading, setUploading] = useState(false);
  const currencies = useCurrencies([draft.value.currency, store.defaultCurrency]);
  const steps: GuidedStep<Draft>[] = [
    {
      id: "name",
      title: t("Product name", "Nom du produit"),
      helper: t(
        "Use the name customers will recognize.",
        "Choisissez le nom que vos clients reconnaîtront.",
      ),
      validate: (v) =>
        !v.name.trim() ? { name: t("Enter a product name.", "Saisissez un nom de produit.") } : {},
      render: ({ value, set }) => (
        <FlowField name="name" label={t("Product name", "Nom du produit")}>
          <input
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={180}
          />
        </FlowField>
      ),
    },
    {
      id: "price",
      title: t("Price and currency", "Prix et devise"),
      helper: t("Set the price customers will see.", "Définissez le prix affiché aux clients."),
      validate: (v) => {
        try {
          parseAmount(v.price, v.currency);
          return {};
        } catch {
          return { price: t("Enter a valid positive price.", "Saisissez un prix positif valide.") };
        }
      },
      render: ({ value, set }) => (
        <>
          <FlowField name="price" label={t("Price", "Prix")}>
            <input
              inputMode="decimal"
              value={value.price}
              onChange={(e) => set({ price: e.target.value })}
            />
          </FlowField>
          <FlowField name="currency" label={t("Currency", "Devise")}>
            <select value={value.currency} onChange={(e) => set({ currency: e.target.value })}>
              {currencies.currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </FlowField>
          <ProductFeeMode
            value={value.feeApplicationMode || "INHERIT"}
            onChange={(feeApplicationMode) => set({ feeApplicationMode })}
          />
        </>
      ),
    },
    {
      id: "media",
      title: t("Product media", "Médias du produit"),
      helper: t(
        "Show your product with a photo and an optional short video.",
        "Présentez votre produit avec une photo et, si vous le souhaitez, une courte vidéo.",
      ),
      render: ({ value, set }) => (
        <>
          <MediaUpload
            disabled={uploading}
            label={t("Primary photo", "Photo principale")}
            ownerName={value.name}
            aspect={1}
            value={value.images[0]}
            scope="commerce-product-images"
            storeId={store.id}
            onBusy={setUploading}
            onChange={(url) => set({ images: value.images.map((old, i) => (i === 0 ? url : old)) })}
          />
          <details>
            <summary>
              {t("Add a short video (optional)", "Ajouter une courte vidéo (facultatif)")}
            </summary>
            <MediaUpload
              disabled={uploading}
              label={t("Product video", "Vidéo du produit")}
              kind="video"
              value={value.video}
              duration={value.duration}
              ownerName={value.name}
              scope="commerce-product-videos"
              storeId={store.id}
              maxBytes={store.effectiveProductVideoMaxBytes}
              maxSeconds={store.effectiveProductVideoMaxDurationSeconds || 30}
              onBusy={setUploading}
              onChange={(video, duration) => set({ video, duration: duration || 0 })}
            />
          </details>
        </>
      ),
    },
    {
      id: "description",
      title: t("Product description", "Description du produit"),
      helper: t("Explain what the customer is buying.", "Expliquez ce que le client achète."),
      validate: (v) =>
        !v.description.trim()
          ? { description: t("Describe the product.", "Décrivez le produit.") }
          : {},
      render: ({ value, set }) => (
        <FlowField name="description" label={t("Description", "Description")}>
          <textarea
            rows={5}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "type",
      validate: (v) =>
        ["PHYSICAL", "DIGITAL", "SERVICE", "TRAINING"].includes(v.type)
          ? {}
          : { type: t("Choose a product type.", "Choisissez un type de produit.") },
      title: t("Product type", "Type de produit"),
      helper: t(
        "This determines stock or fulfillment details.",
        "Ce choix détermine les informations de stock ou de livraison.",
      ),
      render: ({ value, set }) => (
        <FlowChoices
          name="type"
          value={value.type}
          onChange={(next) => set({ type: next as Draft["type"] })}
          choices={[
            {
              value: "PHYSICAL",
              title: t("Physical", "Physique"),
              description: t(
                "An item with available stock.",
                "Un article avec un stock disponible.",
              ),
              icon: <Package size={22} />,
            },
            {
              value: "DIGITAL",
              title: t("Digital", "Numérique"),
              description: t(
                "A downloadable file or digital access.",
                "Un fichier à télécharger ou un accès numérique.",
              ),
              icon: <Download size={22} />,
            },
            {
              value: "SERVICE",
              title: t("Service", "Service"),
              description: t("A service or appointment.", "Un service ou un rendez-vous."),
              icon: <CalendarDays size={22} />,
            },
            {
              value: "TRAINING",
              title: t("Training", "Formation"),
              description: t(
                "A paid curriculum with modules and private files or links.",
                "Un programme payant avec modules et fichiers privés ou liens.",
              ),
              icon: <BookOpen size={22} />,
            },
          ]}
        />
      ),
    },
    ...(draft.value.type === "PHYSICAL"
      ? [
          {
            id: "stock",
            title: t("Available stock", "Stock disponible"),
            helper: t("How many units can you sell?", "Combien d’unités pouvez-vous vendre ?"),
            validate: (v: Draft) =>
              !v.stock.trim() || !Number.isSafeInteger(Number(v.stock)) || Number(v.stock) < 0
                ? {
                    stock: t(
                      "Enter a whole number of zero or more.",
                      "Saisissez un nombre entier positif ou nul.",
                    ),
                  }
                : {},
            render: ({ value, set }: Parameters<GuidedStep<Draft>["render"]>[0]) => (
              <FlowField name="stock" label={t("Stock quantity", "Quantité en stock")}>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={value.stock}
                  onChange={(e) => set({ stock: e.target.value })}
                />
              </FlowField>
            ),
          },
        ]
      : draft.value.type === "TRAINING"
        ? []
        : [
            {
              id: "fulfillment",
              title: t("Fulfillment", "Livraison et accès"),
              helper: t(
                "Tell customers how to access their purchase.",
                "Indiquez aux clients comment accéder à leur achat.",
              ),
              validate: (v: Draft) =>
                v.fulfillmentUrl && !safeLink(v.fulfillmentUrl)
                  ? {
                      fulfillmentUrl: t(
                        "Enter a valid access or booking link.",
                        "Saisissez un lien d’accès ou de réservation valide.",
                      ),
                    }
                  : {},
              render: ({ value, set }: Parameters<GuidedStep<Draft>["render"]>[0]) => (
                <>
                  {value.type === "DIGITAL" && (
                    <MediaUpload
                      kind="digital"
                      disabled={uploading}
                      label={t("Digital file", "Fichier numérique")}
                      value={value.asset}
                      scope="commerce-digital-assets"
                      storeId={store.id}
                      onBusy={setUploading}
                      onChange={(asset) => set({ asset })}
                    />
                  )}
                  <FlowField
                    name="fulfillmentUrl"
                    label={
                      value.type === "SERVICE"
                        ? t("Booking link", "Lien de réservation")
                        : t("Access or download link", "Lien d’accès ou de téléchargement")
                    }
                  >
                    <input
                      type="url"
                      value={value.fulfillmentUrl}
                      onChange={(e) => set({ fulfillmentUrl: e.target.value })}
                      maxLength={1024}
                    />
                  </FlowField>
                  <FlowField
                    name="instructions"
                    label={t("Customer instructions", "Instructions pour le client")}
                  >
                    <textarea
                      value={value.instructions}
                      onChange={(e) => set({ instructions: e.target.value })}
                    />
                  </FlowField>
                </>
              ),
            },
          ]),
    {
      id: "review",
      title: t("Preview your product", "Aperçu de votre produit"),
      render: ({ value, go }) => (
        <>
          {safeLink(value.images[0]) && (
            <img className="flow-media-preview" src={safeLink(value.images[0])} alt={value.name} />
          )}
          <FlowReview title={t("Product", "Produit")} edit={() => go("name")}>
            <p>
              <strong>{value.name}</strong>
            </p>
            <p className="flow-price">{money(Number(value.price), value.currency)}</p>
          </FlowReview>
          <FlowReview title={t("Payment fees", "Frais de paiement")} edit={() => go("price")}>
            <p>
              {value.feeApplicationMode === "EXCLUSIVE"
                ? t(
                    "EXCLUSIVE · Added to buyer total",
                    "EXCLUSIVE · Ajoutés au total de l’acheteur",
                  )
                : value.feeApplicationMode === "INCLUSIVE"
                  ? t("INCLUSIVE · Included in price", "INCLUSIVE · Inclus dans le prix")
                  : t("Use current fee policy", "Conserver la politique de frais actuelle")}
            </p>
          </FlowReview>
          <FlowReview title={t("Description", "Description")} edit={() => go("description")}>
            <p>{value.description}</p>
          </FlowReview>
          <FlowReview
            title={label(value.type)}
            edit={() =>
              go(
                value.type === "PHYSICAL"
                  ? "stock"
                  : value.type === "TRAINING"
                    ? "type"
                    : "fulfillment",
              )
            }
          >
            <p>
              {value.type === "PHYSICAL"
                ? t("Available stock: ", "Stock disponible : ") + value.stock
                : value.type === "TRAINING"
                  ? t(
                      "Create your draft, then add modules and materials in the curriculum editor that opens next. Publish when your training is ready.",
                      "Créez le brouillon, puis ajoutez les modules et ressources dans l’éditeur de programme qui s’ouvre ensuite. Publiez lorsque la formation est prête.",
                    )
                  : value.fulfillmentUrl ||
                    (value.asset
                      ? t("Digital file attached", "Fichier numérique joint")
                      : t("No access link", "Aucun lien d’accès"))}
            </p>
            {["DIGITAL", "SERVICE"].includes(value.type) && value.instructions && (
              <p>{value.instructions}</p>
            )}
          </FlowReview>
        </>
      ),
    },
  ];
  async function create() {
    const v = draft.value;
    const saved = await request<Product>(
      "/customer-api/commerce/stores/" + store.id + "/products",
      {
        method: "POST",
        body: JSON.stringify({
          name: v.name.trim(),
          priceAmount: parseAmount(v.price, v.currency),
          feeApplicationMode:
            !v.feeApplicationMode || v.feeApplicationMode === "INHERIT"
              ? null
              : v.feeApplicationMode,
          priceCurrency: v.currency,
          description: v.description.trim(),
          type: v.type,
          image1: v.images[0] || null,
          image2: null,
          image3: null,
          image4: null,
          videoUrl: v.video || null,
          videoDurationSeconds: v.duration || null,
          inventoryPolicy: v.type === "PHYSICAL" ? "TRACKED" : "UNLIMITED",
          inventoryQuantity: v.type === "PHYSICAL" ? Number(v.stock) : null,
          requiresShipping: v.type === "PHYSICAL",
          fulfillmentUrl: ["DIGITAL", "SERVICE"].includes(v.type)
            ? v.fulfillmentUrl.trim() || null
            : null,
          fulfillmentInstructions: ["DIGITAL", "SERVICE"].includes(v.type)
            ? v.instructions.trim() || null
            : null,
          digitalAssetKey: v.type === "DIGITAL" ? v.asset || null : null,
          status: v.type === "TRAINING" ? "DRAFT" : "ACTIVE",
          storefrontEnabled: true,
          directLinkEnabled: true,
          marketplaceEnabled: true,
        }),
      },
    );
    draft.clear();
    invalidateQueryPaths([
      "/customer-api/commerce/stores/" + store.id + "/products",
      "/customer-api/commerce/stores/" + store.id + "/pos/products/search",
      "/customer-api/commerce/products/" + saved.id,
    ]);
    notify(
      v.type === "TRAINING"
        ? t(
            "Training draft created. Add your first module.",
            "Brouillon de formation créé. Ajoutez votre premier module.",
          )
        : t("Product added.", "Produit ajouté."),
    );
    onSaved?.(saved);
    onClose();
  }
  return (
    <GuidedFlow
      id="product"
      title={t("Add product", "Ajouter un produit")}
      steps={steps}
      value={draft.value}
      set={draft.set}
      dirty={draft.dirty}
      onDiscard={draft.clear}
      onClose={onClose}
      onFinish={create}
      finalLabel={
        draft.value.type === "TRAINING"
          ? t("Create draft & add modules", "Créer le brouillon et ajouter les modules")
          : t("Add product", "Ajouter le produit")
      }
      busy={uploading}
      loading={draft.restoring || currencies.loading}
      dependencyError={currencies.error}
      retry={refresh}
    />
  );
}
