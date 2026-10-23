import { businessDestination } from "./business-tools";

export const developerSections = [
  { id: "wallets", href: "/developers/wallets", label: "Wallets" },
  { id: "transactions", href: "/developers/transactions", label: "Transactions" },
  { id: "guides", href: "/developers/guides", label: "API guides" },
] as const;
export type DeveloperSection = "credentials" | (typeof developerSections)[number]["id"];

/** Carry only shared, non-sensitive context between developer sections. */
export function developerHref(section: DeveloperSection, values: URLSearchParams) {
  const path = section === "credentials" ? "/developers" : `/developers/${section}`;
  const query = new URLSearchParams();
  for (const key of ["business", "businessPage", "environment"]) {
    const value = values.get(key);
    if (value) query.set(key, value);
  }
  return businessDestination(path + (query.size ? `?${query}` : "")) || path;
}

/** Old bookmarked selections still open their corresponding focused page. */
export function legacyDeveloperDestination(values: URLSearchParams, hash = "") {
  if (values.get("createKey") === "1") return;
  const transaction = [...values.keys()].some(
    (key) =>
      key.startsWith("api_") || ["apiReference", "apiPage", "apiDetailBusiness"].includes(key),
  );
  const section = transaction
    ? "transactions"
    : values.get("guide") === "1" || values.has("doc") || hash === "#integration-guide"
      ? "guides"
      : undefined;
  if (section) return businessDestination(`/developers/${section}?${values}`);
}
