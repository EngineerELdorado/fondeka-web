import type { ApiEnvironment } from "./types";

export interface PortalFilters {
  action: string;
  status: string;
  currency: string;
  reference: string;
  clientReference: string;
  fromDate: string;
  toDate: string;
}
export const emptyFilters: PortalFilters = {
  action: "",
  status: "",
  currency: "",
  reference: "",
  clientReference: "",
  fromDate: "",
  toDate: "",
};
export const transactionStatuses = [
  "NONE",
  "INITIATED",
  "SUBMITTED",
  "PROCESSING",
  "FUNDED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "MANUAL_INTERVENTION_REQUIRED",
  "UNKNOWN",
];
export function portalQuery(
  filters: PortalFilters,
  page: number,
  environment: ApiEnvironment = "LIVE",
) {
  const params = new URLSearchParams({ environment, page: String(page), size: "10" });
  for (const key of ["action", "status", "currency", "reference", "clientReference"] as const) {
    const value = filters[key].trim();
    if (!value) continue;
    if ((key === "reference" || key === "clientReference") && value.length > 128)
      throw new Error("References must be 128 characters or fewer.");
    if (key === "currency" && !/^[A-Za-z]{3}$/.test(value))
      throw new Error("Enter a three-letter fiat currency code.");
    params.set(key, key === "currency" ? value.toUpperCase() : value);
  }
  const from = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : undefined;
  const to = filters.toDate ? new Date(`${filters.toDate}T23:59:59.999`).getTime() : undefined;
  if (
    (from !== undefined && (!Number.isFinite(from) || from < 0)) ||
    (to !== undefined && (!Number.isFinite(to) || to < 0))
  )
    throw new Error("Choose a valid date on or after January 1, 1970.");
  if (from !== undefined && to !== undefined && from > to)
    throw new Error("The start date must be on or before the end date.");
  if (from !== undefined) params.set("fromDate", String(from));
  if (to !== undefined) params.set("toDate", String(to));
  return params.toString();
}
