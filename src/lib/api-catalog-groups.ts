import type { ApiCatalogMethod } from "./api-catalog";
import { countryOptions, normalizeCountry } from "./payment-country";

export type ApiCatalogCountryGroup = {
  code: string;
  countryCode?: string;
  name: string;
  flag?: string;
  methods: ApiCatalogMethod[];
};

/** Keep the complete configured catalog; country selection only filters the current view. */
export function groupCatalogMethods(methods: ApiCatalogMethod[], language: "en" | "fr") {
  const countries = new Map(countryOptions(language).map((country) => [country.code, country]));
  const groups = new Map<string, ApiCatalogCountryGroup>();
  for (const method of methods) {
    const countryCode = normalizeCountry(method.countryCode);
    const code = countryCode || "OTHER";
    let group = groups.get(code);
    if (!group) {
      const country = countryCode ? countries.get(countryCode) : undefined;
      group = {
        code,
        countryCode,
        name:
          countryCode === "CD"
            ? language === "fr"
              ? "RD Congo"
              : "DR Congo"
            : country?.name ||
              (method.type === "CRYPTO"
                ? language === "fr"
                  ? "International"
                  : "Global"
                : language === "fr"
                  ? "Autres moyens"
                  : "Other methods"),
        flag: country?.flag,
        methods: [],
      };
      groups.set(code, group);
    }
    group.methods.push(method);
  }
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.code === "CD") - Number(a.code === "CD") ||
      Number(a.code === "OTHER") - Number(b.code === "OTHER") ||
      a.name.localeCompare(b.name, language),
  );
}

const searchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();

export function filterCatalogGroups(
  groups: ApiCatalogCountryGroup[],
  country: string,
  query: string,
) {
  const needle = searchText(query.trim());
  return groups
    .filter((group) => !country || group.code === country)
    .map((group) => ({
      ...group,
      methods: group.methods.filter((method) =>
        searchText(
          [
            method.name,
            method.displayName,
            method.paymentCurrency,
            group.name,
            group.countryCode,
            group.code === "CD" ? "DRC RDC Congo" : "",
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(needle),
      ),
    }))
    .filter((group) => group.methods.length > 0);
}
