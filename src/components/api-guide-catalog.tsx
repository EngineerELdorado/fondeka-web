"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Globe2, ListFilter, Network, Percent, RefreshCw, Search } from "lucide-react";
import {
  apiCatalogPath,
  catalogMethodsFor,
  catalogMethodSelectable,
  catalogNetworksFor,
  parseApiCatalog,
  type ApiPaymentKind,
} from "@/lib/api-catalog";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import type { ApiEnvironment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { request } from "@/lib/data";
import { useCurrencies } from "@/lib/use-currencies";
import { countryFlag, normalizeCountry } from "@/lib/payment-country";
import { Empty, ErrorState, Loading, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { ApiCatalogFees } from "./api-catalog-fees";

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
  preferredMethod,
  currency,
  currencyControl,
}: {
  businessId: number;
  kind: ApiPaymentKind;
  payout: boolean;
  environment: ApiEnvironment;
  preferredMethod?: string;
  currency: string;
  currencyControl: React.ReactNode;
}) {
  const { t, language } = useI18n();
  const path = apiCatalogPath(businessId, currency);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState<{
    path: string;
    data?: unknown;
    error?: string;
    loading: boolean;
  }>({ path: "", loading: true });
  const checking = query.path !== path || query.loading;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{ method: string; network?: string }>();
  // Private account tariffs live only in this scoped panel, never in a persistent/shared cache.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setQuery({ path, loading: true });
    void request<unknown>(path, { signal: controller.signal }).then(
      (data) => {
        if (active) setQuery({ path, data, loading: false });
      },
      (error) => {
        if (active)
          setQuery({
            path,
            error:
              error instanceof Error
                ? error.message
                : t(
                    "Couldn’t load payment methods.",
                    "Impossible de charger les moyens de paiement.",
                  ),
            loading: false,
          });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, revision, language, t]);
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);
  let catalog;
  let parseError;
  if (!checking && query.data !== undefined) {
    try {
      catalog = parseApiCatalog(query.data, currency);
    } catch {
      parseError = t(
        "The catalog response could not be read. Refresh to try again.",
        "La réponse du catalogue est illisible. Actualisez pour réessayer.",
      );
    }
  }
  const error = query.error || parseError;
  const context = (
    <div className="api-catalog-context">
      <span>
        {kind === "CRYPTO" ? <Network size={15} /> : <Globe2 size={15} />}
        {kind === "CRYPTO"
          ? t("Cryptos & compatible networks", "Cryptos et réseaux compatibles")
          : t("All configured countries", "Tous les pays configurés")}
      </span>
      <span className={`environment-tag ${environment.toLowerCase()}`}>{environment}</span>
      {currencyControl}
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
  );
  if (!catalog) {
    if (query.loading || checking)
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
          retry={() => void refresh()}
        />
      </>
    );
  }
  const methods = catalogMethodsFor(catalog, kind, environment);
  const visible = methods.filter((method) =>
    `${method.name} ${method.displayName || ""} ${kind === "MOBILE_MONEY" ? method.countryCode || "" : ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const method =
    methods.find((item) => item.name === (selection?.method ?? preferredMethod)) ||
    methods.find((item) => catalogMethodSelectable(item, environment, payout)) ||
    methods[0];
  const networks = method ? catalogNetworksFor(catalog, method, environment, payout) : [];
  const network = networks.find((item) => item.name === selection?.network) || networks[0];
  return (
    <>
      {context}
      {error && <ErrorState message={error} retry={() => void refresh()} />}
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
                      : t("Name or country code", "Nom ou code pays")
                  }
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
                    disabled={checking || !!error}
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
                        {payout
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
                {kind === "CRYPTO"
                  ? t("No matching cryptos.", "Aucune crypto correspondante.")
                  : t("No matching methods.", "Aucun moyen correspondant.")}
              </p>
            )}
          </section>
          <aside
            className="api-catalog-selection"
            aria-label={t("Fees and payload identifiers", "Frais et identifiants du payload")}
          >
            <span className="api-catalog-selection-icon">
              <Percent size={20} />
            </span>
            <h3>
              {method?.displayName ||
                method?.name ||
                t("Fees & identifiers", "Frais et identifiants")}
            </h3>
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
                <ApiCatalogFees
                  method={method}
                  payout={payout}
                  currency={currency}
                  environment={environment}
                />
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
  const { t } = useI18n();
  const { accountKey, apiEnvironment } = useWorkspace();
  const environment = setup.environment || apiEnvironment;
  const scope = `${accountKey}:${setup.business?.id}`;
  const [currencySelection, setCurrencySelection] = useState<{ scope: string; value: string }>();
  const currency = currencySelection?.scope === scope ? currencySelection.value : "USD";
  const products = useCurrencies(["USD", currency]);
  const currencyControl = (
    <label className="api-catalog-fee-currency">
      <span>{t("Fiat fee currency", "Devise fiat des frais")}</span>
      <select
        value={currency}
        onChange={(event) => setCurrencySelection({ scope, value: event.target.value })}
      >
        {products.currencies.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
      {products.error && (
        <button type="button" className="text-button" onClick={() => void products.refetch()}>
          {t("Reload currencies", "Recharger les devises")}
        </button>
      )}
    </label>
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
      key={`${accountKey}:${setup.business.id}:${environment}:${kind}:${payout}`}
      businessId={setup.business.id}
      kind={kind}
      payout={payout}
      environment={environment}
      preferredMethod={preferredMethod}
      currency={currency}
      currencyControl={currencyControl}
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
      description={t(
        "Browse payment methods, compatible networks and your account’s fees. No API key is needed.",
        "Explorez les moyens de paiement, les réseaux compatibles et les frais de votre compte. Aucune clé API n’est nécessaire.",
      )}
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
