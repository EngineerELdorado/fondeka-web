"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Store } from "@/lib/types";
import { hasToolAccess } from "@/lib/business-tools";
import { useBusinessTools } from "./business-tools-provider";
import { useWorkspace } from "./workspace-provider";
import {
  GuidedFlow,
  FlowField,
  FlowReview,
  FlowSuccess,
  useFlowDraft,
  type GuidedStep,
} from "./guided-flow";
type Draft = { name: string; description: string };
export function StoreCreateFlow({
  onClose,
  forPos = false,
}: {
  onClose: () => void;
  forPos?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { refresh } = useWorkspace();
  const { state } = useBusinessTools();
  const access = state.accountAccess;
  const privateStore =
    !!access && !hasToolAccess(access, "ONLINE_STORES") && hasToolAccess(access, "POS");
  const draft = useFlowDraft<Draft>("store", { name: "", description: "" }, [
    "name",
    "description",
  ]);
  const account = useQuery<{
    defaultFiatCurrency?: string;
    accountBalanceCurrency?: string;
    countryCode?: string;
  }>("/customer-api/accounts/my-account");
  const currency =
    account.data?.defaultFiatCurrency || account.data?.accountBalanceCurrency || "USD";
  const [saved, setSaved] = useState<Store>();
  const steps: GuidedStep<Draft>[] = [
    {
      id: "name",
      title: t("Store name", "Nom de la boutique"),
      helper: t("Choose a clear name.", "Choisissez un nom clair."),
      validate: (v) =>
        !v.name.trim() ? { name: t("Enter a store name.", "Saisissez un nom de boutique.") } : {},
      render: ({ value, set }) => (
        <FlowField name="name" label={t("Store name", "Nom de la boutique")}>
          <input
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={160}
            autoComplete="organization"
          />
        </FlowField>
      ),
    },
    {
      id: "description",
      title: t("Business description", "Description de l’activité"),
      helper: t(
        "Explain what your business sells or offers.",
        "Expliquez ce que votre entreprise vend ou propose.",
      ),
      validate: (v) =>
        !v.description.trim()
          ? {
              description: t(
                "Explain what your business does.",
                "Expliquez l’activité de votre entreprise.",
              ),
            }
          : {},
      render: ({ value, set }) => (
        <FlowField
          name="description"
          label={t("What do you sell or offer?", "Que vendez-vous ou proposez-vous ?")}
        >
          <textarea
            rows={5}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "review",
      title: t("Review your store", "Vérifiez votre boutique"),
      helper: t(
        "You can add products and customize your store next.",
        "Vous pourrez ensuite ajouter des produits et personnaliser votre boutique.",
      ),
      render: ({ value, go }) => (
        <>
          <FlowReview title={t("Store name", "Nom de la boutique")} edit={() => go("name")}>
            <p>
              <strong>{value.name}</strong>
            </p>
          </FlowReview>
          <FlowReview
            title={t("Business description", "Description de l’activité")}
            edit={() => go("description")}
          >
            <p>{value.description}</p>
          </FlowReview>
          <FlowReview title={t("Your store", "Votre boutique")}>
            <div className="flow-row">
              <span>{t("Status", "Statut")}</span>
              <strong>{t("Active", "Actif")}</strong>
            </div>
            <div className="flow-row">
              <span>{t("Visibility", "Visibilité")}</span>
              <strong>
                {privateStore
                  ? t("Private · for POS", "Privée · pour le POS")
                  : t("Public", "Public")}
              </strong>
            </div>
            <div className="flow-row">
              <span>{t("Currency", "Devise")}</span>
              <strong>{currency}</strong>
            </div>
            <div className="flow-row">
              <span>{t("Store creation", "Création de la boutique")}</span>
              <strong>
                {t("Included with Business Tools", "Incluse avec les outils Business")}
              </strong>
            </div>
          </FlowReview>
          {privateStore && (
            <p className="info-box">
              {t(
                "Your POS access includes a private store and catalogue. Activate Online Stores when you want to publish it.",
                "Votre accès POS inclut une boutique privée et son catalogue. Activez Boutiques en ligne pour la publier.",
              )}
            </p>
          )}
        </>
      ),
    },
  ];
  async function create() {
    const result = await request<Store>("/customer-api/commerce/stores", {
      method: "POST",
      body: JSON.stringify({
        name: draft.value.name.trim(),
        description: draft.value.description.trim(),
        defaultCurrency: currency,
        reportCurrency: currency,
        ...(account.data?.countryCode ? { countryCode: account.data.countryCode } : {}),
        status: "ACTIVE",
        visibility: privateStore ? "PRIVATE" : "PUBLIC",
      }),
    });
    draft.clear();
    invalidateQueryPaths(["/customer-api/commerce/stores?"]);
    setSaved(result);
  }
  if (saved)
    return (
      <FlowSuccess
        title={t("Store created", "Boutique créée")}
        message={
          privateStore
            ? t(
                "Your private store is ready. Add products and start selling with POS.",
                "Votre boutique privée est prête. Ajoutez des produits et commencez à vendre avec le POS.",
              )
            : t(
                "Your store is ready. Add products, customize it and share its link.",
                "Votre boutique est prête. Ajoutez des produits, personnalisez-la et partagez son lien.",
              )
        }
        action={forPos ? t("Open POS", "Ouvrir le POS") : t("View store", "Voir la boutique")}
        onContinue={() => router.push(`/stores/${saved.id}${forPos ? "/pos" : ""}`)}
      />
    );
  return (
    <GuidedFlow
      id="store"
      title={t("Create a store", "Créer une boutique")}
      steps={steps}
      value={draft.value}
      set={draft.set}
      dirty={draft.dirty}
      onDiscard={draft.clear}
      onClose={onClose}
      onFinish={create}
      finalLabel={t("Create store", "Créer la boutique")}
      loading={draft.restoring || account.loading}
      dependencyError={account.error}
      retry={refresh}
    />
  );
}
