import type { BusinessApiTopic } from "./business-api-docs";
import type { ApiGuideSetup } from "./api-guide-setup";

/** Older backends and unavailable setup keep the bill guides closed. */
export function billPaymentGuidesReady(setup: ApiGuideSetup) {
  return !setup.loading && !setup.error && setup.business?.billPaymentsApiReady === true;
}

export function apiGuideAvailable(
  id: BusinessApiTopic["id"],
  billPaymentsApiReady: unknown = false,
) {
  return id !== "bill-payments" || billPaymentsApiReady === true;
}
