"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Copy,
  FileText,
  Globe2,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { mayMountOwnerData } from "@/lib/business-tools-client";
import { businessDisplayName } from "@/lib/business-profile";
import { useQuery } from "@/lib/use-query";
import type { Business, Page } from "@/lib/types";
import { useBusinessTools, useToolNavigation } from "./business-tools-provider";
import { Badge, Empty, ErrorState, Loading } from "./ui";

export function BusinessSettings() {
  const { t, language } = useI18n();
  const { client, state } = useBusinessTools();
  const navigation = useToolNavigation();
  const allowed = mayMountOwnerData(state, "/developers", navigation.enabled);
  const businesses = useQuery<Page<Business>>(
    allowed ? "/customer-api/businesses?page=0&size=20" : null,
  );
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const business = businesses.data?.content[0];
  const name = businessDisplayName(business);
  const missing = t("Not provided", "Non renseigné");
  const refresh = () => void businesses.refetch();

  async function copyId() {
    if (!business) return;
    try {
      await navigator.clipboard.writeText(String(business.id));
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError(
        t(
          "Copy failed. Select the ID and copy it manually.",
          "La copie a échoué. Sélectionnez l’identifiant et copiez-le manuellement.",
        ),
      );
    }
  }

  if (!allowed) {
    if (state.loading) return <Loading rows={4} />;
    if (state.error) return <ErrorState message={state.error} retry={() => void client.reload()} />;
    if (state.access?.accessGranted)
      return (
        <ErrorState
          message={t(
            "Business details are temporarily unavailable. Please refresh and try again.",
            "Les informations Business sont temporairement indisponibles. Actualisez et réessayez.",
          )}
          retry={() => void client.reload()}
        />
      );
    return (
      <Empty
        icon={LockKeyhole}
        title={t("Your Business details", "Vos informations Business")}
        description={t(
          "Activate Business Tools to access your Business profile.",
          "Activez les outils Business pour accéder à votre profil Business.",
        )}
      >
        <button
          type="button"
          className="button primary"
          onClick={() => navigation.open("/developers")}
        >
          {t("Open Business Tools", "Ouvrir les outils Business")}
        </button>
      </Empty>
    );
  }
  if (businesses.loading) return <Loading rows={4} />;
  if (businesses.error) return <ErrorState message={businesses.error} retry={refresh} />;
  if (!business)
    return (
      <Empty
        icon={Building2}
        title={t("Your Business profile", "Votre profil Business")}
        description={t(
          "Your Business details will appear here once your profile is set up.",
          "Vos informations Business apparaîtront ici une fois votre profil créé.",
        )}
      />
    );

  let country = business.countryCode?.trim().toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country)) {
    try {
      country = new Intl.DisplayNames([language], { type: "region" }).of(country) || country;
    } catch {
      /* Keep the backend country code. */
    }
  }

  return (
    <>
      {businesses.refreshError && (
        <div className="info-box" role="status">
          {t(
            "Couldn’t refresh your Business details. Showing the last loaded details.",
            "Impossible d’actualiser vos informations Business. Les dernières informations chargées sont affichées.",
          )}
          <button type="button" className="text-button" onClick={refresh}>
            {t("Refresh", "Actualiser")}
          </button>
        </div>
      )}
      <div className="business-settings-layout">
        <section className="panel business-profile-panel">
          <div className="panel-heading">
            <h2>
              <Building2 size={18} />
              {t("Business details", "Informations Business")}
            </h2>
            <button
              type="button"
              className="icon-button bordered"
              aria-label={t("Refresh Business details", "Actualiser les informations Business")}
              onClick={refresh}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="business-profile-body">
            <div className="business-profile-identity">
              <span className="business-profile-avatar" aria-hidden="true">
                {name ? name.slice(0, 1).toUpperCase() : <Building2 size={27} />}
              </span>
              <div>
                <h2>{name || t("Your Business", "Votre Business")}</h2>
                <div className="business-profile-id">
                  <span>
                    {t("Business ID", "Identifiant Business")} : <code>{business.id}</code>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void copyId()}
                    aria-label={t("Copy Business ID", "Copier l’identifiant Business")}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="sr-only" role="status">
              {copied ? t("Business ID copied", "Identifiant Business copié") : ""}
            </p>
            {copyError && (
              <p className="form-error" role="alert">
                {copyError}
              </p>
            )}
            <dl className="business-profile-fields">
              <div>
                <dt>
                  <Building2 size={16} aria-hidden="true" />
                  {t("Business name", "Nom du Business")}
                </dt>
                <dd>{name || missing}</dd>
              </div>
              <div>
                <dt>
                  <FileText size={16} aria-hidden="true" />
                  {t("Legal name", "Raison sociale")}
                </dt>
                <dd>{business.legalName?.trim() || missing}</dd>
              </div>
              <div>
                <dt>
                  <Globe2 size={16} aria-hidden="true" />
                  {t("Country", "Pays")}
                </dt>
                <dd>{country || missing}</dd>
              </div>
              <div>
                <dt>
                  <FileText size={16} aria-hidden="true" />
                  {t("Registration number", "Numéro d’immatriculation")}
                </dt>
                <dd>{business.registrationNumber?.trim() || missing}</dd>
              </div>
            </dl>
            <p className="business-profile-note">
              <Info size={17} aria-hidden="true" />
              {t(
                "Business profile updates are not available in the portal yet.",
                "La modification du profil Business n’est pas encore disponible sur le portail.",
              )}
            </p>
          </div>
        </section>
        <aside className="panel business-profile-status">
          <span className="tool-icon mint">
            <ShieldCheck size={23} />
          </span>
          <h2>{t("Status & verification", "Statut et vérification")}</h2>
          <dl className="detail-list">
            <div>
              <dt>{t("Business status", "Statut du Business")}</dt>
              <dd>
                <Badge value={business.status} />
              </dd>
            </div>
            <div>
              <dt>{t("Verification", "Vérification")}</dt>
              <dd>
                <Badge value={business.kybStatus} />
              </dd>
            </div>
          </dl>
          <p>
            {t("These statuses are managed by Fondeka.", "Ces statuts sont gérés par Fondeka.")}
          </p>
        </aside>
      </div>
    </>
  );
}
