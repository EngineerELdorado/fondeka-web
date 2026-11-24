import { validCatalogFeeSchedule, type CatalogFeeSchedule } from "./api-catalog-fees";

export const publicBillCatalogRoute = "/api/public/business-api/bill-products";

export type BillCatalogQuery = { amount?: string; currency: string; countryCode?: string };
export type BillCatalogProduct = {
  code: string;
  name: string;
  displayName: string;
  category: string;
  countryCodes: string[];
  feeSchedule?: CatalogFeeSchedule;
  pricing?: {
    status: "AVAILABLE";
    currency: string;
    amount: number;
    fee: number;
    grossAmount: number;
  };
  commission?: { basis: "NET_AMOUNT" | "REVENUE"; percentage: number; maxPoints?: number };
};
export type BillCatalog = {
  environment: "LIVE";
  pricingScope: "STANDARD" | "ACCOUNT";
  amount?: number;
  currency: string;
  countryCode?: string;
  calculatedAt: string;
  binding: false;
  products: BillCatalogProduct[];
};

export function billCatalogQuery(
  amount?: string,
  currency = "USD",
  countryCode = "",
): BillCatalogQuery {
  amount = amount?.trim();
  currency = currency.trim().toUpperCase();
  countryCode = countryCode.trim().toUpperCase();
  if (
    amount !== undefined &&
    (!/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?$/.test(amount) ||
      Number(amount) < 0.01 ||
      Number(amount) > 1000000)
  )
    throw new Error("Invalid preview amount.");
  if (!/^[A-Z]{3}$/.test(currency) || (countryCode && !/^[A-Z]{2}$/.test(countryCode)))
    throw new Error("Invalid currency or country.");
  return {
    ...(amount !== undefined ? { amount: Number(amount).toFixed(2) } : {}),
    currency,
    ...(countryCode ? { countryCode } : {}),
  };
}

export function billCatalogPath(query: BillCatalogQuery, businessId?: number) {
  if (businessId !== undefined && (!Number.isSafeInteger(businessId) || businessId <= 0))
    throw new Error("Invalid Business ID.");
  const path =
    businessId === undefined
      ? publicBillCatalogRoute
      : `/customer-api/businesses/${businessId}/api-bill-products`;
  return `${path}?${new URLSearchParams({ ...query })}`;
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const money = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Allowlisted fields only. Public discovery never exposes account commission information. */
export function parseBillCatalog(
  value: unknown,
  query: BillCatalogQuery,
  publicGuide: boolean,
): BillCatalog {
  const source = object(value);
  const scope = publicGuide ? "STANDARD" : "ACCOUNT";
  if (
    source.environment !== "LIVE" ||
    source.pricingScope !== scope ||
    source.binding !== false ||
    source.currency !== query.currency ||
    (query.amount !== undefined && source.amount !== Number(query.amount)) ||
    !Array.isArray(source.products) ||
    typeof source.calculatedAt !== "string" ||
    !Number.isFinite(Date.parse(source.calculatedAt))
  )
    throw new Error("Invalid bill catalog response.");
  const products = source.products.map((value): BillCatalogProduct => {
    const row = object(value);
    if (
      typeof row.code !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,127}$/.test(row.code) ||
      typeof row.category !== "string" ||
      !["ELECTRICITY", "WATER", "TELEVISION"].includes(row.category)
    )
      throw new Error("Invalid bill product.");
    const pricing = object(row.pricing);
    const schedule = row.feeSchedule;
    const commission = object(row.commission);
    return {
      code: row.code,
      name: typeof row.name === "string" ? row.name : row.code,
      displayName:
        typeof row.displayName === "string" && row.displayName.trim() ? row.displayName : row.code,
      category: row.category,
      countryCodes: Array.isArray(row.countryCodes)
        ? row.countryCodes.filter((v): v is string => typeof v === "string" && /^[A-Z]{2}$/.test(v))
        : [],
      ...(validCatalogFeeSchedule(schedule, "REQUEST_AMOUNT", query.currency)
        ? {
            feeSchedule: {
              status: schedule.status,
              currency: schedule.currency,
              rangeAmountBasis: schedule.rangeAmountBasis,
              feeAmountBasis: schedule.feeAmountBasis,
              quoteRequired: schedule.quoteRequired,
              unavailableReason: schedule.unavailableReason,
              ranges: schedule.ranges.map((range) => ({
                minAmount: range.minAmount,
                maxAmountExclusive: range.maxAmountExclusive,
                available: range.available,
                fee: range.fee
                  ? {
                      percentage: range.fee.percentage,
                      flatFee: range.fee.flatFee,
                      minimum: range.fee.minimum
                        ? {
                            percentage: range.fee.minimum.percentage,
                            flatFee: range.fee.minimum.flatFee,
                          }
                        : null,
                    }
                  : null,
              })),
            },
          }
        : {}),
      ...(pricing.status === "AVAILABLE" &&
      pricing.currency === query.currency &&
      money(pricing.amount) &&
      pricing.amount > 0 &&
      money(pricing.fee) &&
      money(pricing.grossAmount) &&
      Math.abs(pricing.amount + pricing.fee - pricing.grossAmount) < 0.005
        ? {
            pricing: {
              status: "AVAILABLE",
              currency: query.currency,
              amount: pricing.amount,
              fee: pricing.fee,
              grossAmount: pricing.grossAmount,
            },
          }
        : {}),
      ...(!publicGuide &&
      (commission.basis === "NET_AMOUNT" || commission.basis === "REVENUE") &&
      money(commission.percentage) &&
      commission.percentage > 0 &&
      commission.percentage <= 100
        ? {
            commission: {
              basis: commission.basis,
              percentage: commission.percentage,
              ...(money(commission.maxPoints) ? { maxPoints: commission.maxPoints } : {}),
            },
          }
        : {}),
    };
  });
  return {
    environment: "LIVE",
    pricingScope: scope,
    ...(query.amount !== undefined ? { amount: Number(query.amount) } : {}),
    currency: query.currency,
    countryCode:
      typeof source.countryCode === "string" && /^[A-Z]{2}$/.test(source.countryCode)
        ? source.countryCode
        : undefined,
    calculatedAt: source.calculatedAt,
    binding: false,
    products,
  };
}
