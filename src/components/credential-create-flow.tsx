"use client";
import { useI18n } from "@/lib/i18n";
import { credentialPayload } from "@/lib/credential-form";
import { uiText } from "@/lib/ui-copy";
import type { ApiEnvironment } from "@/lib/types";
import { GuidedFlow, FlowField, FlowReview, useFlowDraft, type GuidedStep } from "./guided-flow";
type CredentialDraft = { name: string; webhookUrl: string };
export function CredentialCreateFlow({
  environment,
  onClose,
  onCreate,
  closeRequest,
}: {
  environment: ApiEnvironment;
  onClose: () => void;
  onCreate: (name: string, url: string) => Promise<void>;
  closeRequest: { current: (() => void) | null };
}) {
  const { t, language } = useI18n();
  const draft = useFlowDraft<CredentialDraft>("api-key", { name: "", webhookUrl: "" });
  const steps: GuidedStep<CredentialDraft>[] = [
    {
      id: "name",
      title: t("Credential name", "Nom de la clé"),
      helper: t(
        "Choose a name that identifies your integration.",
        "Choisissez un nom permettant d’identifier votre intégration.",
      ),
      validate: (v) =>
        !v.name.trim() || v.name.trim().length > 100
          ? {
              name: t(
                "Enter an integration name of 1–100 characters.",
                "Saisissez un nom d’intégration de 1 à 100 caractères.",
              ),
            }
          : {},
      render: ({ value, set }) => (
        <FlowField name="name" label={t("Integration name", "Nom de l’intégration")}>
          <input
            maxLength={100}
            autoComplete="off"
            placeholder={t("e.g. Merchant ERP", "Ex. ERP marchand")}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "webhook",
      title: t("Webhook destination", "Destination des webhooks"),
      helper: t(
        "Fondeka sends signed payment updates to this public HTTPS endpoint on your server.",
        "Fondeka envoie les mises à jour de paiement signées à cette adresse HTTPS publique de votre serveur.",
      ),
      validate: (v) => {
        try {
          credentialPayload(v.name, v.webhookUrl, environment);
          return {};
        } catch (error) {
          return {
            webhookUrl:
              error instanceof Error
                ? uiText(error.message, language)
                : t("Enter a valid public HTTPS URL.", "Saisissez une URL HTTPS publique valide."),
          };
        }
      },
      render: ({ value, set }) => (
        <FlowField name="webhookUrl" label={t("Webhook URL", "URL du webhook")}>
          <input
            type="url"
            maxLength={2048}
            autoComplete="off"
            placeholder="https://merchant.example/webhooks/fondeka"
            value={value.webhookUrl}
            onChange={(e) => set({ webhookUrl: e.target.value })}
          />
        </FlowField>
      ),
    },
    {
      id: "review",
      title: t("Review and security", "Vérification et sécurité"),
      render: ({ value, go }) => (
        <>
          <span className={"environment-tag " + environment.toLowerCase()}>{environment}</span>
          <FlowReview title={t("Integration", "Intégration")} edit={() => go("name")}>
            <p>{value.name}</p>
          </FlowReview>
          <FlowReview
            title={t("Webhook destination", "Destination des webhooks")}
            edit={() => go("webhook")}
          >
            <p className="break-word">{value.webhookUrl}</p>
          </FlowReview>
          <p className="info-box">
            {t(
              "Your API key and signing secret will be shown only once. Save both securely on your integration server.",
              "Votre clé API et votre secret de signature ne seront affichés qu’une fois. Conservez-les en sécurité sur votre serveur d’intégration.",
            )}
          </p>
          <p className="muted">
            {environment === "SANDBOX"
              ? t(
                  "These test credentials use sandbox funds only.",
                  "Ces identifiants de test utilisent uniquement des fonds sandbox.",
                )
              : t(
                  "These credentials can authorize real payments.",
                  "Ces identifiants peuvent autoriser des paiements réels.",
                )}{" "}
            {t(
              "The environment cannot be changed later.",
              "L’environnement ne pourra pas être modifié.",
            )}
          </p>
        </>
      ),
    },
  ];
  return (
    <GuidedFlow
      compact
      id="api-key"
      title={t("Create API key", "Créer une clé API")}
      steps={steps}
      value={draft.value}
      set={draft.set}
      dirty={draft.dirty}
      onDiscard={draft.clear}
      onClose={onClose}
      closeRequest={closeRequest}
      finalLabel={t("Create API key", "Créer la clé API")}
      onFinish={async () => {
        await onCreate(draft.value.name, draft.value.webhookUrl);
        draft.clear();
      }}
    />
  );
}
