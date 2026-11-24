import release from "../../public/docs/business-api/release.json";
import { normalizeBillPaymentAvailability } from "./api-guide-availability";

export async function fetchPublicBillPaymentAvailability(timeoutMs = 8000) {
  const base = process.env.FONDEKA_API_BASE_URL || release.baseUrl;
  const response = await fetch(
    `${base.replace(/\/$/, "")}/public/business-api/guide-availability`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (!response.ok) throw new Error("Guide availability is unavailable.");
  const status = await response.json();
  if (!status || typeof status !== "object" || Array.isArray(status))
    throw new Error("Invalid guide availability.");
  return normalizeBillPaymentAvailability(
    status.billPaymentsApiReady,
    status.billPaymentsApiAvailability,
  );
}
