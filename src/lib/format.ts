import { uiText } from "./ui-copy";
export const currencies = [
  "USD",
  "CDF",
  "EUR",
  "GBP",
  "NGN",
  "KES",
  "XAF",
  "XOF",
  "ZAR",
  "UGX",
  "RWF",
  "TZS",
  "GHS",
];

export function money(value: number | string | null | undefined, currency = "USD") {
  if (value == null) return "—";
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat(
      typeof document === "undefined" ? "en" : document.documentElement.lang,
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
export function date(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat(
    typeof document === "undefined" ? "en" : document.documentElement.lang,
    { month: "short", day: "numeric", year: "numeric" },
  ).format(new Date(value));
}
export function label(value?: string) {
  if (!value) return "—";
  if (typeof document !== "undefined" && document.documentElement.lang.startsWith("fr")) {
    const labels: Record<string, string> = {
      ACTIVE: "Actif",
      INACTIVE: "Inactif",
      DRAFT: "Brouillon",
      SUSPENDED: "Suspendu",
      COMPLETED: "Terminé",
      CANCELLED: "Annulé",
      CANCELED: "Annulé",
      EXPIRED: "Expiré",
      ARCHIVED: "Archivé",
      PUBLIC: "Public",
      PRIVATE: "Privé",
      PAID: "Payé",
      PARTIALLY_PAID: "Partiellement payé",
      ON_CREDIT: "À crédit",
      PROCESSING: "En cours",
      PENDING: "En attente",
      FAILED: "Échoué",
      REVOKED: "Révoqué",
      APPROVED: "Approuvé",
      REJECTED: "Refusé",
      NOT_SUBMITTED: "Non soumis",
      QUICK_CHARGE: "Encaissement rapide",
      INVOICE: "Facture",
      DONATION: "Don / financement participatif",
      CASH: "Espèces",
      FONDEKA: "Fondeka",
      PHYSICAL: "Physique",
      DIGITAL: "Numérique",
      SERVICE: "Service",
      OWNER: "Propriétaire",
      STAFF: "Équipe",
      POS: "POS",
      REPORTS: "Rapports",
      PRODUCTS: "Produits",
      SALES: "Ventes",
      CUSTOMERS: "Clients",
      ENABLED: "Activé",
      REFUNDED: "Remboursé",
      UNKNOWN: "À vérifier",
      MANUAL_INTERVENTION_REQUIRED: "Vérification requise",
    };
    if (labels[value]) return labels[value];
  }
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
export function amountInMinorUnits(value: string | number, currency = "USD") {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const normalized = String(value).trim();
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`);
  if (!pattern.test(normalized))
    throw new Error(
      typeof document !== "undefined" && document.documentElement.lang.startsWith("fr")
        ? `Saisissez un montant valide avec ${digits} décimales maximum.`
        : `Enter a valid amount with up to ${digits} decimal places.`,
    );
  const [whole, fraction = ""] = normalized.split(".");
  const units = Number(whole + fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(units) || units <= 0)
    throw new Error(uiText("Enter an amount greater than zero and within the supported range."));
  return units;
}
export function parseAmount(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return amountInMinorUnits(value, currency) / 10 ** digits;
}
export function safeLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}
