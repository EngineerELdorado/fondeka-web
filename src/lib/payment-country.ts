import countries from "./countries.json";
// Country/calling-code catalog aligned with fondeka-pay/src/data/countries.js.
const countryCodes = new Set(countries.map(([code]) => code));
export function normalizeCountry(value: unknown) {
  if (typeof value !== "string") return;
  const code = value.trim().toUpperCase();
  return countryCodes.has(code) ? code : undefined;
}
export function countryFromHeaders(headers: Pick<Headers, "get">) {
  for (const name of [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "cloudfront-viewer-country",
  ]) {
    const code = normalizeCountry(headers.get(name));
    if (code) return code;
  }
}
export function resolvePaymentCountry({
  selected,
  detected,
  accountCountry,
  accountLoading = false,
}: {
  selected?: string;
  detected?: string;
  accountCountry?: string;
  accountLoading?: boolean;
}) {
  return (
    normalizeCountry(selected) ||
    normalizeCountry(detected) ||
    normalizeCountry(accountCountry) ||
    (accountLoading ? undefined : "CD")
  );
}
export function countryFlag(code: string) {
  return String.fromCodePoint(...Array.from(code, (c) => 127397 + c.charCodeAt(0)));
}
export function countryOptions(language: "en" | "fr") {
  const names = new Intl.DisplayNames([language], { type: "region" });
  return countries
    .map(([code, callingCode]) => ({
      code,
      callingCode,
      name: names.of(code) || code,
      flag: countryFlag(code),
    }))
    .sort(
      (a, b) =>
        Number(b.code === "CD") - Number(a.code === "CD") || a.name.localeCompare(b.name, language),
    );
}
export function filterCountries(options: ReturnType<typeof countryOptions>, query: string) {
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const needle = normalized(query.trim()).replace(/^\+/, "");
  return options.filter((country) =>
    normalized(`${country.name} ${country.code} ${country.callingCode}`).includes(needle),
  );
}
