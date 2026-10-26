"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Globe2, ListFilter, Network, Percent, RefreshCw, Search } from "lucide-react";
import {
  catalogFeeCurrency,
  catalogMethodsFor,
  catalogMethodSelectable,
  catalogNetworksFor,
  defaultCatalogCurrency,
  type ApiCatalog,
  type ApiPaymentKind,
} from "@/lib/api-catalog";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import type { ApiEnvironment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useApiCatalog } from "@/lib/use-api-catalog";
import { filterCatalogGroups, groupCatalogMethods } from "@/lib/api-catalog-groups";
import { Empty, ErrorState, Loading, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { ApiCatalogFees } from "./api-catalog-fees";
import { CurrencyBadge } from "./currency-identity";
import { CatalogMethodLogo } from "./catalog-method-logo";

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
  catalog,
  checking,
  error,
  refresh,
  kind,
  payout,
  environment,
  preferredMethod,
  accountKey,
  businessId,
}: {
  catalog?: ApiCatalog;
  checking: boolean;
  error?: string;
  refresh: () => Promise<void>;
  kind: ApiPaymentKind;
  payout: boolean;
  environment: ApiEnvironment;
  preferredMethod?: string;
  accountKey: string | null;
  businessId: number;
}) {
  const { t, language } = useI18n();
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const groupId = useId();
  const [selection, setSelection] = useState<{ method: string; network?: string }>();
  const methods = catalog ? catalogMethodsFor(catalog, kind, environment) : [];
  const groups = groupCatalogMethods(methods, language);
  const selectedCountry = groups.some((group) => group.code === country) ? country : "";
  const visibleGroups = filterCatalogGroups(groups, selectedCountry, search);
  const visible = visibleGroups.flatMap((group) => group.methods);
  const method =
    visible.find((item) => item.name === (selection?.method ?? preferredMethod)) ||
    visible.find((item) => catalogMethodSelectable(item, environment, payout)) ||
    visible[0];
  const currency = catalogFeeCurrency(method);
  const localizedFees = environment === "LIVE" && currency !== defaultCatalogCurrency;
  const feeQuery = useApiCatalog(
    accountKey,
    localizedFees ? businessId : undefined,
    currency,
    language,
  );
  const feeMethod = method && {
    ...method,
    fees: localizedFees
      ? feeQuery.data?.paymentMethods.find((item) => item.name === method.name)?.fees
      : method.fees,
  };
  const refreshing = checking || feeQuery.loading;
  const refreshAll = async () => {
    await Promise.all([refresh(), feeQuery.refresh()]);
  };
  const context = (
    <div className="api-catalog-context">
      <span>
        {kind === "CRYPTO" ? <Network size={15} /> : <Globe2 size={15} />}
        {kind === "CRYPTO"
          ? t("Cryptos & compatible networks", "Cryptos et réseaux compatibles")
          : t("All configured countries", "Tous les pays configurés")}
      </span>
      <span className={`environment-tag ${environment.toLowerCase()}`}>{environment}</span>
      <button
        type="button"
        className="text-button"
        disabled={refreshing}
        onClick={() => void refreshAll()}
      >
        <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
        {refreshing ? t("Refreshing…", "Actualisation…") : t("Refresh", "Actualiser")}
      </button>
    </div>
  );
  if (!catalog) {
    if (checking)
      return (
        <>
          {context}
          <Loading rows={4} />
        </>
      );
    return (
      <>
        {context}
        <ErrorState
          message={
            error ||
            t("Couldn’t load payment methods.", "Impossible de charger les moyens de paiement.")
          }
          retry={() => void refreshAll()}
        />
      </>
    );
  }
  const methodCountry = groups.find(
    (group) => group.countryCode && group.methods.some((item) => item.name === method?.name),
  );
  const networks = method ? catalogNetworksFor(catalog, method, environment, payout) : [];
  const network =
    networks.find(
      (item) => method?.name === selection?.method && item.name === selection?.network,
    ) || networks[0];
  return (
    <>
      {context}
      {error && <ErrorState message={error} retry={() => void refreshAll()} />}
      {!methods.length ? (
        <Empty
          icon={ListFilter}
          title={t("No methods available", "Aucun moyen disponible")}
          description={t(
            "No methods are configured for this payment type in this environment. Refresh after configuration changes.",
            "Aucun moyen n’est configuré pour ce type de paiement dans cet environnement. Actualisez après une modification de la configuration.",
          )}
        />
      ) : (
        <div className="api-catalog-layout">
          <section
            className="api-catalog-methods"
            aria-label={kind === "CRYPTO" ? "Cryptos" : t("Payment methods", "Moyens de paiement")}
          >
            <div
              className={`api-catalog-discovery ${kind === "CRYPTO" && !groups.some((group) => group.countryCode) ? "api-catalog-discovery-global" : ""}`}
            >
              <label className="api-catalog-search">
                <span>
                  {kind === "CRYPTO"
                    ? t("Find a crypto", "Rechercher une crypto")
                    : t("Find a method", "Rechercher un moyen")}
                </span>
                <div>
                  <Search size={16} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={
                      kind === "CRYPTO"
                        ? t("Name or symbol (e.g. USDT)", "Nom ou symbole (ex. USDT)")
                        : t("Name, code or currency", "Nom, code ou devise")
                    }
                  />
                </div>
              </label>
              {(kind === "MOBILE_MONEY" || groups.some((group) => group.countryCode)) && (
                <label className="api-catalog-country-filter">
                  <span>{t("Country", "Pays")}</span>
                  <select
                    value={selectedCountry}
                    onChange={(event) => {
                      setCountry(event.target.value);
                      setSelection(undefined);
                    }}
                  >
                    <option value="">{t("All countries", "Tous les pays")}</option>
                    {groups.map((group) => (
                      <option key={group.code} value={group.code}>
                        {group.flag ? `${group.flag} ` : ""}
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div
              className="api-catalog-country-groups"
              role="region"
              tabIndex={0}
              aria-label={t("Payment methods by country", "Moyens de paiement par pays")}
            >
              {visibleGroups.map((group) => (
                <section
                  className="api-catalog-country-group"
                  key={group.code}
                  aria-labelledby={`${groupId}-${group.code}`}
                >
                  <h4 id={`${groupId}-${group.code}`}>
                    {group.flag ? (
                      <span className="api-catalog-country-flag" aria-hidden="true">
                        {group.flag}
                      </span>
                    ) : (
                      <Globe2 size={17} aria-hidden="true" />
                    )}
                    <strong>{group.name}</strong>
                    {group.countryCode && <code>{group.countryCode}</code>}
                    <span
                      className="api-catalog-country-count"
                      aria-label={`${group.methods.length} ${t("methods", "moyens")}`}
                    >
                      {group.methods.length}
                    </span>
                  </h4>
                  <div className="api-catalog-grid">
                    {group.methods.map((item) => {
                      const selectable = catalogMethodSelectable(item, environment, payout);
                      return (
                        <button
                          type="button"
                          className="api-catalog-method"
                          key={item.name}
                          disabled={checking || !!error}
                          aria-pressed={method?.name === item.name}
                          onClick={() => {
                            setSelection({
                              method: item.name,
                              network: catalogNetworksFor(catalog, item, environment, payout)[0]
                                ?.name,
                            });
                          }}
                        >
                          <span className="api-catalog-method-top">
                            <CatalogMethodLogo method={item} />
                            {method?.name === item.name && <Check size={16} />}
                          </span>
                          <span className="api-catalog-method-label">
                            <strong>{item.displayName || item.name}</strong>
                            {item.paymentCurrency?.trim() && (
                              <span
                                className="api-catalog-method-currency"
                                title={t("Method currency", "Devise du moyen de paiement")}
                              >
                                <CurrencyBadge currency={item.paymentCurrency} />
                              </span>
                            )}
                          </span>
                          <code>{item.name}</code>
                          {!selectable ? (
                            <small>
                              {payout
                                ? t("Payouts disabled in LIVE", "Envois désactivés en LIVE")
                                : t(
                                    "Collections disabled in LIVE",
                                    "Encaissements désactivés en LIVE",
                                  )}
                            </small>
                          ) : environment === "SANDBOX" &&
                            (!item.active ||
                              !(payout ? item.allowingPayout : item.allowingCollection)) ? (
                            <small>{t("Sandbox testing only", "Tests sandbox uniquement")}</small>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
              {!visible.length && (
                <div className="api-catalog-no-matches" role="status">
                  <p>
                    {t(
                      "No methods match these filters.",
                      "Aucun moyen ne correspond à ces filtres.",
                    )}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setSearch("");
                      setCountry("");
                      setSelection(undefined);
                    }}
                  >
                    {t("Clear filters", "Effacer les filtres")}
                  </button>
                </div>
              )}
            </div>
          </section>
          <aside
            className="api-catalog-selection"
            aria-label={t("Fees and payload identifiers", "Frais et identifiants du payload")}
          >
            <div className="api-catalog-selected-header">
              <span className="api-catalog-selection-icon">
                {method ? <CatalogMethodLogo method={method} /> : <Percent size={20} />}
              </span>
              <h3 className="api-catalog-selected-heading">
                <span className="api-catalog-selected-name">
                  {method?.displayName ||
                    method?.name ||
                    t("Fees & identifiers", "Frais et identifiants")}
                </span>
                {methodCountry && (
                  <span className="api-catalog-selected-country">{methodCountry.name}</span>
                )}
              </h3>
            </div>
            <p>
              {t(
                kind === "CRYPTO"
                  ? "Explore fees and compatible networks. Copy the exact names for your payload."
                  : "Explore fees, then copy the exact name for your payload.",
                kind === "CRYPTO"
                  ? "Consultez les frais et les réseaux compatibles. Copiez les noms exacts pour votre payload."
                  : "Consultez les frais, puis copiez le nom exact pour votre payload.",
              )}
            </p>
            {method && (
              <>
                {feeQuery.loading ? (
                  <div className="api-catalog-fees" role="status" aria-busy="true">
                    <p>
                      {t(`Loading fees in ${currency}…`, `Chargement des frais en ${currency}…`)}
                    </p>
                    <Loading rows={2} />
                  </div>
                ) : feeQuery.error ? (
                  <ErrorState message={feeQuery.error} retry={() => void feeQuery.refresh()} />
                ) : (
                  <ApiCatalogFees
                    method={feeMethod!}
                    payout={payout}
                    currency={currency}
                    environment={environment}
                  />
                )}
                <CopyIdentifier
                  key={method.name}
                  name="paymentMethodName"
                  value={method.name}
                  disabled={
                    checking || !!error || !catalogMethodSelectable(method, environment, payout)
                  }
                />
                {kind === "CRYPTO" && (
                  <>
                    <div className="api-catalog-networks">
                      <h4>
                        <Network size={15} aria-hidden="true" />
                        {t("Available networks", "Réseaux disponibles")}
                        <span>{networks.length}</span>
                      </h4>
                      <div role="group" aria-label={t("Available networks", "Réseaux disponibles")}>
                        {networks.map((item) => (
                          <button
                            type="button"
                            key={item.name}
                            disabled={checking || !!error}
                            aria-pressed={network?.name === item.name}
                            onClick={() =>
                              setSelection({ method: method.name, network: item.name })
                            }
                          >
                            <span>
                              <strong>{item.displayName || item.name}</strong>
                              <code>{item.name}</code>
                            </span>
                            {network?.name === item.name && <Check size={16} aria-hidden="true" />}
                          </button>
                        ))}
                      </div>
                    </div>
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
                    {environment === "SANDBOX"
                      ? t("Method currency", "Devise du moyen de paiement")
                      : kind === "CRYPTO"
                        ? t(
                            "Token currency. Fees and examples are shown in USD.",
                            "Devise du jeton. Les frais et les exemples sont affichés en USD.",
                          )
                        : t(
                            "Fees and examples are shown in this currency.",
                            "Les frais et les exemples sont affichés dans cette devise.",
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
              "Sandbox uses simulated payments. Inactive identifiers remain available for testing; LIVE tariffs are not sandbox fees.",
              "Le sandbox simule les paiements. Les identifiants inactifs restent disponibles pour les tests ; les tarifs LIVE ne sont pas les frais sandbox.",
            )
          : t(
              "Configuration flags are a guide. Routing, currencies, fees and account restrictions are still validated by the backend.",
              "Les indicateurs de configuration vous orientent. Le backend valide toujours le routage, les devises, les frais et les restrictions du compte.",
            )}
      </p>
    </>
  );
}

type CatalogBrowserProps = {
  setup: ApiGuideSetup;
  kind: ApiPaymentKind;
  payout: boolean;
  preferredMethod?: string;
};

function CatalogBrowser({ setup, kind, payout, preferredMethod }: CatalogBrowserProps) {
  const { t, language } = useI18n();
  const { accountKey, apiEnvironment } = useWorkspace();
  const environment = setup.environment || apiEnvironment;
  const query = useApiCatalog(
    accountKey,
    !setup.loading && !setup.error ? setup.business?.id : undefined,
    defaultCatalogCurrency,
    language,
  );
  if (setup.loading) return <Loading rows={3} />;
  if (setup.error) return <ErrorState message={setup.error} retry={setup.refresh} />;
  if (!setup.business)
    return (
      <Empty
        title={t("No Business available", "Aucun Business disponible")}
        description={t(
          "An owned Business is required to read its payment catalog. No API key is needed.",
          "Un Business dont vous êtes propriétaire est requis pour lire son catalogue. Aucune clé API n’est nécessaire.",
        )}
      />
    );
  return (
    <CatalogContent
      key={`${accountKey}:${setup.business.id}:${environment}:${kind}`}
      catalog={query.data}
      checking={query.loading}
      error={query.error}
      refresh={query.refresh}
      kind={kind}
      payout={payout}
      environment={environment}
      preferredMethod={preferredMethod}
      accountKey={accountKey}
      businessId={setup.business.id}
    />
  );
}

export function ApiGuidePaymentMethods({
  setup,
  onClose,
}: {
  setup: ApiGuideSetup;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [kind, setKind] = useState<ApiPaymentKind>("MOBILE_MONEY");
  const [payout, setPayout] = useState(false);
  return createPortal(
    <Modal
      title={t("Available payment methods", "Moyens de paiement disponibles")}
      className={`api-catalog-modal ${kind === "CRYPTO" ? "api-catalog-crypto" : ""}`}
      onClose={onClose}
    >
      <div className="api-catalog-filters">
        <label>
          <span>{t("Payment type", "Type de paiement")}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as ApiPaymentKind)}>
            <option value="MOBILE_MONEY">{t("Mobile money", "Mobile money")}</option>
            <option value="CRYPTO">Cryptos</option>
          </select>
        </label>
        <label>
          <span>{t("Operation", "Opération")}</span>
          <select
            value={payout ? "payout" : "collection"}
            onChange={(event) => setPayout(event.target.value === "payout")}
          >
            <option value="collection">{t("Collections", "Encaissements")}</option>
            <option value="payout">{t("Payouts", "Décaissements")}</option>
          </select>
        </label>
      </div>
      <CatalogBrowser setup={setup} kind={kind} payout={payout} />
    </Modal>,
    document.body,
  );
}

export function ApiGuideCatalog({
  setup,
  kind,
  payout,
  target = "methods",
  preferredMethod,
}: CatalogBrowserProps & {
  target?: "methods" | "networks";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="guide-catalog-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {target === "networks" ? <Network size={14} /> : <ListFilter size={14} />}
        {target === "networks"
          ? t("Available networks", "Réseaux disponibles")
          : t("Available methods", "Moyens disponibles")}
      </button>
      {open &&
        createPortal(
          <Modal
            title={
              target === "networks"
                ? t("Available crypto networks", "Réseaux crypto disponibles")
                : kind === "CRYPTO"
                  ? t("Available methods & networks", "Moyens et réseaux disponibles")
                  : t("Available payment methods", "Moyens de paiement disponibles")
            }
            description={
              kind === "CRYPTO"
                ? t(
                    "Choose a crypto to explore its active, compatible networks.",
                    "Choisissez une crypto pour découvrir ses réseaux actifs et compatibles.",
                  )
                : t(
                    "Configured mobile-money names across all countries.",
                    "Les noms des moyens mobile money configurés dans tous les pays.",
                  )
            }
            className={`api-catalog-modal ${kind === "CRYPTO" ? "api-catalog-crypto" : ""}`}
            onClose={() => setOpen(false)}
          >
            <CatalogBrowser
              setup={setup}
              kind={kind}
              payout={payout}
              preferredMethod={preferredMethod}
            />
          </Modal>,
          document.body,
        )}
    </>
  );
}
