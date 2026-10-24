import type { Business } from "./types";
import { normalizeCountry } from "./payment-country";
import { updateCachedQueries } from "./query-cache";

export const businessListPath = "/customer-api/businesses?page=0&size=20";
export function businessDetailsPath(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid Business ID.");
  return `/customer-api/businesses/${id}`;
}
export type BusinessDetailsDraft = {
  name: string;
  legalName: string;
  countryCode: string;
  registrationNumber: string;
};
export type BusinessDetailsField = keyof BusinessDetailsDraft;
export type BusinessDetailsPatch = Partial<{
  name: string;
  legalName: string | null;
  countryCode: string | null;
  registrationNumber: string | null;
}>;
export function businessDetailsDraft(business: Business): BusinessDetailsDraft {
  return {
    name: business.name?.trim() || "",
    legalName: business.legalName?.trim() || "",
    countryCode: business.countryCode?.trim().toUpperCase() || "",
    registrationNumber: business.registrationNumber?.trim() || "",
  };
}
export function businessDetailsErrors(draft: BusinessDetailsDraft) {
  const errors: Partial<Record<BusinessDetailsField, "required" | "tooLong" | "country">> = {};
  if (!draft.name.trim()) errors.name = "required";
  for (const [field, max] of [
    ["name", 180],
    ["legalName", 254],
    ["registrationNumber", 128],
  ] as const)
    if (draft[field].trim().length > max) errors[field] = "tooLong";
  const country = draft.countryCode.trim().toUpperCase();
  if (country && (!/^[A-Z]{2}$/.test(country) || !normalizeCountry(country) || country === "XK"))
    errors.countryCode = "country";
  return errors;
}
export function businessDetailsPatch(
  business: Business,
  draft: BusinessDetailsDraft,
): BusinessDetailsPatch {
  if (Object.keys(businessDetailsErrors(draft)).length)
    throw new Error("Invalid Business details.");
  const before = businessDetailsDraft(business);
  const patch: BusinessDetailsPatch = {};
  if (draft.name.trim() !== before.name) patch.name = draft.name.trim();
  for (const field of ["legalName", "countryCode", "registrationNumber"] as const) {
    const value = field === "countryCode" ? draft[field].trim().toUpperCase() : draft[field].trim();
    if (value !== before[field]) patch[field] = value || null;
  }
  return patch;
}
/** Retain only intentional edits over the latest server values after a conflict. */
export function rebaseBusinessDetails(
  before: Business,
  draft: BusinessDetailsDraft,
  latest: Business,
) {
  const patch = businessDetailsPatch(before, draft);
  const next = businessDetailsDraft(latest);
  for (const field of Object.keys(patch) as BusinessDetailsField[])
    next[field] = patch[field] || "";
  return next;
}
export function parseBusinessDetails(value: unknown, id: number): Business {
  const business = value as Business;
  if (
    !business ||
    business.id !== id ||
    typeof business.name !== "string" ||
    !business.name.trim() ||
    typeof business.status !== "string" ||
    typeof business.kybStatus !== "string" ||
    [business.legalName, business.countryCode, business.registrationNumber].some(
      (field) => field !== undefined && field !== null && typeof field !== "string",
    )
  )
    throw new Error("Invalid Business details response. Refresh to check the saved details.");
  return business;
}
export function replaceBusinessDetails(accountKey: string, business: Business, generation: number) {
  const detail = businessDetailsPath(business.id);
  updateCachedQueries(
    accountKey,
    (path, data) => {
      if (path === detail) return business;
      if (!/^\/customer-api\/businesses(?:\?|$)/.test(path)) return;
      if (Array.isArray(data))
        return data.map((item: Business) => (item.id === business.id ? business : item));
      const page = data as { content?: Business[] };
      if (Array.isArray(page?.content))
        return {
          ...page,
          content: page.content.map((item) => (item.id === business.id ? business : item)),
        };
    },
    generation,
  );
}

/** Provisioned account references are placeholders, not business display names. */
export function businessDisplayName(business?: Pick<Business, "name" | "legalName">) {
  return [business?.name, business?.legalName]
    .map((value) => value?.trim())
    .find((value) => value && !/^(?:Business\s+)?(?:FDK\d+|\d+)$/i.test(value))
    ?.replace(/^Business\s+/i, "");
}
