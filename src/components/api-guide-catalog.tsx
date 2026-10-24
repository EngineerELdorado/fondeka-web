"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Globe2, ListFilter, Network, RefreshCw, Search } from "lucide-react";
import {
  apiCatalogPath,
  catalogMethodSelectable,
  catalogNetworksFor,
  parseApiCatalog,
  type ApiPaymentKind,
} from "@/lib/api-catalog";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import type { ApiEnvironment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { countryFlag, normalizeCountry } from "@/lib/payment-country";
import { Empty, ErrorState, Loading, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

function CopyIdentifier({
  name,
  value,
  disabled,
}: {
  name: string;
  value: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="api-catalog-identifier">
      <span>{name}</span>
      <div>
        <code>{value}</code>
        <button
          type="button"
          className="icon-button"
          disabled={disabled}
          aria-label={`${t("Copy", "Copier")} ${name}: ${value}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <small role="status">
        {error
          ? t("Select and copy the name manually.", "Sélectionnez et copiez le nom manuellement.")
          : copied
            ? t("Copied", "Copié")
            : ""}
      </small>
    </div>
  );
}

function CatalogContent({
  businessId,
  kind,
  payout,
  environment,
}: {
  businessId: number;
  kind: ApiPaymentKind;
  payout: boolean;
  environment: ApiEnvironment;
}) {
  const { t } = useI18n();
  const query = useQuery<unknown>(apiCatalogPath(businessId));
  const { refetch } = query;
  const [checking, setChecking] = useState(true);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{ method: string; network?: string }>();
  // This reference panel revalidates on every opening. The shared account cache coalesces GETs.
  useEffect(() => {
    let active = true;
    const finish = () => {
      if (active) setChecking(false);
    };
    void refetch().finally(finish);
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      setChecking(true);
      void refetch().finally(finish);
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refetch]);
  const refresh = async () => {
    setChecking(true);
    await query.refetch();
    setChecking(false);
  };
  let catalog;
  let parseError;
  if (query.data !== undefined) {
    try {
      catalog = parseApiCatalog(query.data);
    } catch {
      parseError = t(
        "The catalog response could not be read. Refresh to try again.",
        "La réponse du catalogue est illisible. Actualisez pour réessayer.",
      );
    }
  }
  const error = query.error || query.refreshError || parseError;
  if (!catalog) {
    if (query.loading || checking) return <Loading rows={4} />;
    return (
      <ErrorState
        message={
          error ||
          t("Couldn’t load payment methods.", "Impossible de charger les moyens de paiement.")
        }
        retry={() => void refresh()}
      />
    );
  }
  const methods = catalog.paymentMethods.filter((method) => method.type === kind);
  const visible = methods.filter((method) =>
    `${method.name} ${method.displayName || ""} ${method.countryCode || ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const method = methods.find(
    (item) => item.name === selection?.method && catalogMethodSelectable(item, environment, payout),
  );
  const networks = method ? catalogNetworksFor(catalog, method, environment, payout) : [];
  const network = networks.find((item) => item.name === selection?.network) || networks[0];
  return (
    <>
      <div className="api-catalog-context">
        <span>
          <Globe2 size={15} />
          {t("All configured countries", "Tous les pays configurés")}
        </span>
        <span className={`environment-tag ${environment.toLowerCase()}`}>{environment}</span>
        <button
          type="button"
          className="text-button"
          disabled={checking}
          onClick={() => void refresh()}
        >
          <RefreshCw size={14} className={checking ? "spin" : undefined} />
          {checking ? t("Refreshing…", "Actualisation…") : t("Refresh", "Actualiser")}
        </button>
      </div>
      {error && <ErrorState message={error} retry={() => void refresh()} />}
      {!methods.length ? (
        <Empty
          icon={ListFilter}
          title={t("No configured methods", "Aucun moyen configuré")}
          description={t(
            "No methods are configured for this payment type. Refresh after backend configuration changes.",
            "Aucun moyen n’est configuré pour ce type de paiement. Actualisez après une modification de la configuration.",
          )}
        />
      ) : (
        <div className="api-catalog-layout">
          <section
            className="api-catalog-methods"
            aria-label={t("Payment methods", "Moyens de paiement")}
          >
            <label className="api-catalog-search">
              <span>{t("Find a method", "Rechercher un moyen")}</span>
              <div>
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Name or country code", "Nom ou code pays")}
                />
              </div>
            </label>
            <div className="api-catalog-grid">
              {visible.map((item) => {
                const selectable = catalogMethodSelectable(item, environment, payout);
                const country = normalizeCountry(item.countryCode);
                return (
                  <button
                    type="button"
                    className="api-catalog-method"
                    key={item.name}
                    disabled={!selectable || checking || !!error}
                    aria-pressed={method?.name === item.name}
                    onClick={() => {
                      setSelection({
                        method: item.name,
                        network: catalogNetworksFor(catalog, item, environment, payout)[0]?.name,
                      });
                    }}
                  >
                    <span className="api-catalog-method-top">
                      <span aria-hidden="true">
                        {country ? countryFlag(country) : <Network size={20} />}
                      </span>
                      {method?.name === item.name && <Check size={16} />}
                    </span>
                    <strong>{item.displayName || item.name}</strong>
                    <code>{item.name}</code>
                    {!selectable ? (
                      <small>
                        {!item.active
                          ? t("Inactive in LIVE", "Inactif en LIVE")
                          : payout
                            ? t("Payouts disabled in LIVE", "Envois désactivés en LIVE")
                            : t("Collections disabled in LIVE", "Encaissements désactivés en LIVE")}
                      </small>
                    ) : environment === "SANDBOX" &&
                      (!item.active ||
                        !(payout ? item.allowingPayout : item.allowingCollection)) ? (
                      <small>{t("Sandbox testing only", "Tests sandbox uniquement")}</small>
                    ) : (
                      <small>{item.countryCode || t("Universal", "Universel")}</small>
                    )}
                  </button>
                );
              })}
            </div>
            {!visible.length && (
              <p className="muted" role="status">
                {t("No matching methods.", "Aucun moyen correspondant.")}
              </p>
            )}
          </section>
          <aside
            className="api-catalog-selection"
            aria-label={t("Payload identifiers", "Identifiants du payload")}
          >
            <span className="api-catalog-selection-icon">
              <Copy size={20} />
            </span>
            <h3>{t("Names for your payload", "Les noms de votre payload")}</h3>
            <p>
              {t(
                "Select a method, then copy its exact identifier.",
                "Sélectionnez un moyen, puis copiez son identifiant exact.",
              )}
            </p>
            {method && (
              <>
                <CopyIdentifier
                  key={method.name}
                  name="paymentMethodName"
                  value={method.name}
                  disabled={checking || !!error}
                />
                {kind === "CRYPTO" && (
                  <>
                    <label className="field">
                      <span>{t("Associated network", "Réseau associé")}</span>
                      <select
                        value={network?.name || ""}
                        disabled={!networks.length || checking || !!error}
                        onChange={(event) =>
                          setSelection({ method: method.name, network: event.target.value })
                        }
                      >
                        {!networks.length && (
                          <option value="">
                            {t("No compatible network", "Aucun réseau compatible")}
                          </option>
                        )}
                        {networks.map((item) => (
                          <option key={item.name} value={item.name}>
                            {item.displayName || item.name} · {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {network ? (
                      <CopyIdentifier
                        key={`${method.name}:${network.name}`}
                        name="networkName"
                        value={network.name}
                        disabled={checking || !!error}
                      />
                    ) : (
                      <p role="status">
                        {t(
                          "No associated network is available in this environment. No network is assumed.",
                          "Aucun réseau associé n’est disponible dans cet environnement. Aucun réseau n’est supposé compatible.",
                        )}
                      </p>
                    )}
                  </>
                )}
                {method.paymentCurrency && (
                  <p className="api-catalog-currency">
                    <strong>{method.paymentCurrency}</strong>
                    {t(
                      "Method currency metadata. Keep currency as your request’s fiat wallet currency.",
                      "Devise du moyen de paiement. Gardez la devise fiat du portefeuille dans currency.",
                    )}
                  </p>
                )}
              </>
            )}
          </aside>
        </div>
      )}
      <p className="api-catalog-footnote">
        {environment === "SANDBOX"
          ? t(
              "Configured names are shared with LIVE. Sandbox uses simulated payments, including inactive configurations.",
              "Les noms configurés sont partagés avec LIVE. Le sandbox simule les paiements, y compris les configurations inactives.",
            )
          : t(
              "Configuration flags are a guide. Routing, currencies, fees and account restrictions are still validated by the backend.",
              "Les indicateurs de configuration vous orientent. Le backend valide toujours le routage, les devises, les frais et les restrictions du compte.",
            )}
      </p>
    </>
  );
}

export function ApiGuideCatalog({
  setup,
  kind,
  payout,
}: {
  setup: ApiGuideSetup;
  kind: ApiPaymentKind;
  payout: boolean;
}) {
  const { t } = useI18n();
  const { accountKey, apiEnvironment } = useWorkspace();
  const [open, setOpen] = useState(false);
  const environment = setup.environment || apiEnvironment;
  return (
    <>
      <button type="button" className="guide-catalog-trigger" onClick={() => setOpen(true)}>
        <ListFilter size={14} />
        {t("Available methods", "Moyens disponibles")}
      </button>
      {open &&
        createPortal(
          <Modal
            title={t("Available payment methods", "Moyens de paiement disponibles")}
            description={
              kind === "CRYPTO"
                ? t(
                    "Configured crypto names and their associated networks.",
                    "Les noms des cryptos configurées et leurs réseaux associés.",
                  )
                : t(
                    "Configured mobile-money names across all countries.",
                    "Les noms des moyens mobile money configurés dans tous les pays.",
                  )
            }
            className={`api-catalog-modal ${kind === "CRYPTO" ? "api-catalog-crypto" : ""}`}
            onClose={() => setOpen(false)}
          >
            {setup.loading ? (
              <Loading rows={3} />
            ) : setup.error ? (
              <ErrorState message={setup.error} retry={setup.refresh} />
            ) : !setup.business ? (
              <Empty
                title={t("No Business available", "Aucun Business disponible")}
                description={t(
                  "An owned Business is required to read its payment catalog. No API key is needed.",
                  "Un Business dont vous êtes propriétaire est requis pour lire son catalogue. Aucune clé API n’est nécessaire.",
                )}
              />
            ) : (
              <CatalogContent
                key={`${accountKey}:${setup.business.id}:${environment}`}
                businessId={setup.business.id}
                kind={kind}
                payout={payout}
                environment={environment}
              />
            )}
          </Modal>,
          document.body,
        )}
    </>
  );
}
