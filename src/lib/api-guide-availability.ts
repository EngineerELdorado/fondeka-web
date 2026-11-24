import type { BusinessApiTopic } from "./business-api-docs";
import type { ApiGuideSetup } from "./api-guide-setup";
import type { BillPaymentApiAvailability } from "./types";

/** An explicit category map is authoritative; older backends retain their all-or-nothing contract. */
export function normalizeBillPaymentAvailability(
  legacyReady: unknown,
  categories?: unknown,
): BillPaymentApiAvailability {
  if (categories === undefined)
    return Object.fromEntries(
      ["ELECTRICITY", "WATER", "TELEVISION"].map((category) => [category, legacyReady === true]),
    );
  if (!categories || typeof categories !== "object" || Array.isArray(categories)) return {};
  return Object.fromEntries(
    Object.entries(categories)
      .filter(([category]) => /^[A-Z][A-Z0-9_]{0,31}$/.test(category))
      .map(([category, ready]) => [category, ready === true]),
  );
}

export function billPaymentGuideAvailability(setup: ApiGuideSetup): BillPaymentApiAvailability {
  if (setup.loading || setup.error) return {};
  return setup.audience === "public"
    ? normalizeBillPaymentAvailability(
        setup.publicBillPaymentsReady,
        setup.publicBillPaymentsAvailability,
      )
    : normalizeBillPaymentAvailability(
        setup.business?.billPaymentsApiReady,
        setup.business?.billPaymentsApiAvailability,
      );
}

export function billGuideLessonAvailable(
  lesson: { billCategory?: string },
  availability: BillPaymentApiAvailability,
) {
  return lesson.billCategory
    ? availability[lesson.billCategory] === true
    : Object.values(availability).some((ready) => ready === true);
}

export function billPaymentGuidesReady(setup: ApiGuideSetup) {
  return Object.values(billPaymentGuideAvailability(setup)).some((ready) => ready === true);
}

export function apiGuideAvailable(
  id: BusinessApiTopic["id"],
  billPaymentsApiReady: unknown = false,
) {
  return id !== "bill-payments" || billPaymentsApiReady === true;
}
