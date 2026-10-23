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
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
export function date(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}
export function label(value?: string) {
  if (!value) return "—";
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
    throw new Error(`Enter a valid amount with up to ${digits} decimal places.`);
  const [whole, fraction = ""] = normalized.split(".");
  const units = Number(whole + fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(units) || units <= 0)
    throw new Error("Enter an amount greater than zero and within the supported range.");
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
