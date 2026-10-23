"use client";
import { useState } from "react";
import { Check, Copy, KeyRound, ArrowUpRight, Webhook, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { demoMode } from "@/lib/auth";
import { guideCredentialHref, type ApiGuideSetup } from "@/lib/api-guide-setup";
import { BusinessToolLink as Link } from "./business-tool-link";
import { ErrorState, Loading } from "./ui";
import release from "../../public/docs/business-api/release.json";

export function ApiGuideQuickstart({ setup }: { setup: ApiGuideSetup }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<number>();
  const [copyError, setCopyError] = useState(false);
  const href = guideCredentialHref(setup.business?.id);
  const businessId = href ? setup.business?.id : undefined;
  return (
    <div className="guide-setup-cards">
      <section className="guide-setup-card">
        <span className="guide-setup-number">1</span>
        <div>
          <h3>{t("Your Business ID", "Votre identifiant Business")}</h3>
          {setup.loading ? (
            <Loading rows={1} />
          ) : setup.error ? (
            <ErrorState message={setup.error} retry={setup.refresh} />
          ) : businessId ? (
            <>
              <div className="guide-business-id">
                <code>{businessId}</code>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(String(businessId));
                      setCopied(businessId);
                      setCopyError(false);
                    } catch {
                      setCopyError(true);
                    }
                  }}
                >
                  {copied === businessId ? <Check size={15} /> : <Copy size={15} />}{" "}
                  {copied === businessId
                    ? t("Copied", "Copié")
                    : t("Copy ID", "Copier l’identifiant")}
                </button>
              </div>
              <small>
                {t(
                  "Use this ID in your Business API endpoint paths.",
                  "Utilisez cet identifiant dans les chemins de l’API Business.",
                )}
              </small>
              <span className="sr-only" role="status">
                {copied === businessId ? t("Business ID copied", "Identifiant Business copié") : ""}
              </span>
              {copyError && (
                <p className="form-error" role="alert">
                  {t(
                    "Select and copy the ID manually.",
                    "Sélectionnez et copiez l’identifiant manuellement.",
                  )}
                </p>
              )}
            </>
          ) : (
            <div className="guide-setup-unavailable">
              <p>
                {t(
                  "No Business is available for this account. Contact support if you expected one.",
                  "Aucun Business n’est disponible pour ce compte. Contactez le support si vous en attendiez un.",
                )}
              </p>
              <button type="button" className="button secondary small" onClick={setup.refresh}>
                {t("Refresh", "Actualiser")}
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="guide-setup-card">
        <span className="guide-setup-number">2</span>
        <div>
          <h3>{t("Create your API key", "Créez votre clé API")}</h3>
          <p>
            {t(
              "Start in SANDBOX. Choose a credential name and your public HTTPS webhook URL.",
              "Commencez en SANDBOX. Choisissez un nom de clé et votre URL webhook HTTPS publique.",
            )}
          </p>
          {href && !setup.loading && !setup.error && !demoMode ? (
            <Link className="button primary" href={href}>
              <KeyRound size={16} />
              {t("Create API key", "Créer une clé API")}
              <ArrowUpRight size={14} />
            </Link>
          ) : (
            <button type="button" className="button primary" disabled>
              <KeyRound size={16} />
              {t("Create API key", "Créer une clé API")}
            </button>
          )}
          {demoMode && (
            <small>
              {t(
                "Key creation is unavailable in the demo.",
                "La création de clés n’est pas disponible en démonstration.",
              )}
            </small>
          )}
        </div>
      </section>
      <section className="guide-setup-card">
        <span className="guide-setup-number">3</span>
        <div>
          <h3>{t("Save both secrets", "Conservez les deux secrets")}</h3>
          <p>
            {t(
              "The API key and webhook signing secret are shown once. Save both securely on your integration server.",
              "La clé API et le secret de signature webhook ne sont affichés qu’une fois. Conservez-les en sécurité sur votre serveur d’intégration.",
            )}
          </p>
          <div className="guide-setup-secrets">
            <span>
              <KeyRound size={15} />
              X-API-Key
            </span>
            <span>
              <Webhook size={15} />
              {t("Webhook signing secret", "Secret de signature webhook")}
            </span>
          </div>
          <dl className="guide-setup-base">
            <dt>{t("Base URL", "URL de base")}</dt>
            <dd>
              <code>{release.baseUrl}</code>
            </dd>
          </dl>
          <small>
            <ShieldCheck size={14} />
            {t(
              "Use separate LIVE credentials when you’re ready for real payments.",
              "Utilisez des identifiants LIVE distincts pour les paiements réels.",
            )}
          </small>
        </div>
      </section>
    </div>
  );
}
