import type { ApiEnvironment } from "./types";
import { validCatalogFees, type CatalogFees } from "./api-catalog-fees";
import { walletCurrency } from "./api-wallets";

export type ApiPaymentKind = "MOBILE_MONEY" | "CRYPTO";
export type ApiCatalogMethod = {
  name: string;
  displayName?: string | null;
  logoUrl?: string | null;
  type: ApiPaymentKind;
  countryCode?: string | null;
  paymentCurrency?: string | null;
  active: boolean;
  allowingCollection: boolean;
  allowingPayout: boolean;
  networkNames: string[];
  fees?: CatalogFees;
};
export type ApiCatalogNetwork = {
  name: string;
  displayName?: string | null;
  active: boolean;
  invoiceCreationEnabled: boolean;
};
export type ApiCatalog = {
  paymentMethods: ApiCatalogMethod[];
  cryptoNetworks: ApiCatalogNetwork[];
};

export const defaultCatalogCurrency = "USD";

/** Crypto method currencies are tokens; the fee catalog only accepts fiat currencies. */
export function catalogFeeCurrency(method?: ApiCatalogMethod) {
  const currency = method?.paymentCurrency?.trim().toUpperCase();
  return method?.type === "MOBILE_MONEY" && currency && /^[A-Z]{3}$/.test(currency)
    ? currency
    : defaultCatalogCurrency;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function optionalText(value: unknown) {
  return value === undefined || value === null || typeof value === "string";
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]*$/.test(value);
}
/** Reject an invalid contract instead of silently inventing usable configuration. */
export function parseApiCatalog(value: unknown, currency?: string): ApiCatalog {
  if (
    !record(value) ||
    !Array.isArray(value.paymentMethods) ||
    !Array.isArray(value.cryptoNetworks) ||
    !value.paymentMethods.every(
      (method) =>
        record(method) &&
        identifier(method.name) &&
        optionalText(method.displayName) &&
        optionalText(method.logoUrl) &&
        (method.type === "MOBILE_MONEY" || method.type === "CRYPTO") &&
        optionalText(method.countryCode) &&
        optionalText(method.paymentCurrency) &&
        typeof method.active === "boolean" &&
        typeof method.allowingCollection === "boolean" &&
        typeof method.allowingPayout === "boolean" &&
        Array.isArray(method.networkNames) &&
        method.networkNames.every(identifier) &&
        validCatalogFees(method.fees, currency),
    ) ||
    !value.cryptoNetworks.every(
      (network) =>
        record(network) &&
        identifier(network.name) &&
        optionalText(network.displayName) &&
        typeof network.active === "boolean" &&
        typeof network.invoiceCreationEnabled === "boolean",
    )
  )
    throw new Error("Invalid Business API catalog response.");
  const catalog = value as ApiCatalog;
  if (
    new Set(catalog.paymentMethods.map((method) => method.name)).size !==
      catalog.paymentMethods.length ||
    new Set(catalog.cryptoNetworks.map((network) => network.name)).size !==
      catalog.cryptoNetworks.length
  )
    throw new Error("Duplicate Business API catalog identifiers.");
  return catalog;
}

export function apiCatalogPath(businessId: number, currency?: string) {
  if (!Number.isSafeInteger(businessId) || businessId <= 0)
    throw new Error("An owned Business ID is required.");
  return `/customer-api/businesses/${businessId}/api-catalog${currency === undefined ? "" : `?${new URLSearchParams({ currency: walletCurrency(currency) })}`}`;
}
export function catalogMethodsFor(
  catalog: ApiCatalog,
  kind: ApiPaymentKind,
  environment: ApiEnvironment = "LIVE",
) {
  return catalog.paymentMethods.filter(
    (method) => (environment === "SANDBOX" || method.active) && method.type === kind,
  );
}
export function catalogMethodSelectable(
  method: ApiCatalogMethod,
  environment: ApiEnvironment,
  payout: boolean,
) {
  return (
    environment === "SANDBOX" ||
    (method.active && (payout ? method.allowingPayout : method.allowingCollection))
  );
}
export function catalogNetworksFor(
  catalog: ApiCatalog,
  method: ApiCatalogMethod,
  environment: ApiEnvironment,
  payout: boolean,
) {
  if ((environment === "LIVE" && !method.active) || method.type !== "CRYPTO") return [];
  const networks = new Map(catalog.cryptoNetworks.map((network) => [network.name, network]));
  return method.networkNames
    .map((name) => networks.get(name))
    .filter((network): network is ApiCatalogNetwork => network !== undefined)
    .filter(
      (network) =>
        environment === "SANDBOX" || (network.active && (payout || network.invoiceCreationEnabled)),
    );
}
