"use client";

import { useState } from "react";
import {
  Building2,
  Check,
  Copy,
  FileText,
  Globe2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { effectiveAccess, mayMountOwnerData } from "@/lib/business-tools-client";
import { businessDetailsPath, businessDisplayName, businessListPath } from "@/lib/business-profile";
import { useQuery } from "@/lib/use-query";
import type { Business, Page } from "@/lib/types";
import { useBusinessTools, useToolNavigation } from "./business-tools-provider";
import { Badge, Empty, ErrorState, Loading } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { BusinessDetailsEditor } from "./business-details-editor";

export function BusinessSettings() {
  const { accountKey } = useWorkspace();
  return <BusinessSettingsSession key={accountKey} />;
}
function BusinessSettingsSession() {
  const { state } = useBusinessTools();
  const { enabled } = useToolNavigation();
  const [editing, setEditing] = useState<Business>();
  const allowed = mayMountOwnerData(state, "/settings", enabled);
  return (
    <>
      {editing && (
        <div hidden={!allowed} inert={!allowed}>
          <BusinessDetailsEditor business={editing} onClose={() => setEditing(undefined)} />
        </div>
      )}
      {(!editing || !allowed) && <BusinessProfile onEdit={setEditing} />}
    </>
  );
}
function BusinessProfile({ onEdit }: { onEdit: (business: Business) => void }) {
  const { t, language } = useI18n();
  const { client, state } = useBusinessTools();
  const navigation = useToolNavigation();
  const allowed = mayMountOwnerData(state, "/settings", navigation.enabled);
  const businesses = useQuery<Page<Business>>(allowed ? businessListPath : null);
  const selected = businesses.data?.content[0];
  const details = useQuery<Business>(allowed && selected ? businessDetailsPath(selected.id) : null);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const business = details.data;
  const name = businessDisplayName(business);
  const missing = t("Not provided", "Non renseigné");
  const refresh = () => void Promise.all([businesses.refetch(), details.refetch()]);

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
    if (effectiveAccess(state, "/settings")?.accessGranted)
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
          onClick={() => navigation.open("/settings")}
        >
          {t("Open Business Tools", "Ouvrir les outils Business")}
        </button>
      </Empty>
    );
  }
  if (businesses.loading || details.loading) return <Loading rows={4} />;
  if (businesses.error) return <ErrorState message={businesses.error} retry={refresh} />;
  if (details.error) return <ErrorState message={details.error} retry={refresh} />;
  if (!selected)
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
  if (!business)
    return (
      <ErrorState
        message={t(
          "Couldn’t load Business details. Please refresh.",
          "Impossible de charger les informations Business. Veuillez actualiser.",
        )}
        retry={refresh}
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
      {(businesses.refreshError || details.refreshError) && (
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
                    Business ID : <code>{business.id}</code>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => void copyId()}
                    aria-label={t("Copy Business ID", "Copier le Business ID")}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="sr-only" role="status">
              {copied ? t("Business ID copied", "Business ID copié") : ""}
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
              <button
                type="button"
                className="button secondary"
                disabled={opening}
                onClick={async () => {
                  setOpening(true);
                  const current = await details.refetch();
                  if (current) onEdit(current);
                  setOpening(false);
                }}
              >
                {opening ? <span className="spinner" /> : <Pencil size={16} />}
                {t("Edit Business details", "Modifier les informations Business")}
              </button>
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
