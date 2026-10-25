export type CatalogFeeExpression = { percentage: number; flatFee: number };
export type CatalogFeeRange = {
  minAmount: number;
  maxAmountExclusive: number | null;
  available: boolean;
  fee: (CatalogFeeExpression & { minimum: CatalogFeeExpression | null }) | null;
};
export type CatalogFeeSchedule = {
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  currency: string;
  rangeAmountBasis: "GROSS_AMOUNT" | "REQUEST_AMOUNT";
  feeAmountBasis: "REQUEST_AMOUNT";
  quoteRequired: true;
  unavailableReason: string | null;
  ranges: CatalogFeeRange[];
};
export type CatalogFees = {
  environment: "LIVE";
  collection: CatalogFeeSchedule;
  payout: CatalogFeeSchedule;
};

/** Teaching examples only: never use these figures as a payment quote or charge. */
export function catalogFeeExample(schedule: CatalogFeeSchedule | undefined) {
  if (!schedule || schedule.status === "UNAVAILABLE") return;
  const cents = (value: number) => Math.round(value * 100) / 100;
  for (const range of schedule.ranges) {
    if (!range.available || !range.fee) continue;
    const rule = range.fee;
    const expressions = [rule, ...(rule.minimum ? [rule.minimum] : [])];
    const feeFor = (amount: number) => {
      const raw = Math.max(
        ...expressions.map((fee) => (amount * fee.percentage) / 100 + fee.flatFee),
      );
      const rounded = cents(raw);
      // Do not turn a small nonzero tariff into an apparently free example.
      return Number.isFinite(rounded) && (rounded > 0 || raw === 0) ? rounded : undefined;
    };
    const inBand = (amount: number) =>
      amount >= range.minAmount &&
      (range.maxAmountExclusive === null || amount < range.maxAmountExclusive);
    const targets = [
      10,
      100,
      1000,
      1,
      0.1,
      0.01,
      range.minAmount + 10,
      range.minAmount + 0.01,
      ...(range.maxAmountExclusive === null
        ? []
        : [(range.minAmount + range.maxAmountExclusive) / 2, range.maxAmountExclusive - 0.01]),
    ];
    const candidates = [
      ...targets,
      ...targets.map(
        (gross) =>
          Math.floor(
            Math.min(
              ...expressions.map((fee) => (gross - fee.flatFee) / (1 + fee.percentage / 100)),
            ) * 100,
          ) / 100,
      ),
    ]
      .map(cents)
      .filter((amount) => amount > 0 && Number.isSafeInteger(Math.round(amount * 100)));
    const exclusiveFor = (amount: number) => {
      const fee = feeFor(amount);
      if (fee === undefined) return;
      const total = cents(amount + fee);
      return inBand(schedule.rangeAmountBasis === "GROSS_AMOUNT" ? total : amount)
        ? { amount, fee, total }
        : undefined;
    };
    const inclusiveFor = (amount: number) => {
      const fee = feeFor(amount);
      if (fee === undefined) return;
      const net = cents(amount - fee);
      return inBand(amount) && net > 0 ? { amount, fee, net } : undefined;
    };
    for (const amount of candidates) {
      const exclusive = exclusiveFor(amount),
        inclusive = inclusiveFor(amount);
      if (exclusive && inclusive) return { exclusive, inclusive, currency: schedule.currency };
    }
    const exclusive = candidates.map(exclusiveFor).find((value) => value !== undefined);
    const inclusive = candidates.map(inclusiveFor).find((value) => value !== undefined);
    if (exclusive && inclusive) return { exclusive, inclusive, currency: schedule.currency };
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const nonnegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const expression = (value: unknown): value is CatalogFeeExpression & Record<string, unknown> =>
  record(value) && nonnegative(value.percentage) && nonnegative(value.flatFee);

function schedule(
  value: unknown,
  basis: CatalogFeeSchedule["rangeAmountBasis"],
  currency?: string,
) {
  if (
    !record(value) ||
    !["AVAILABLE", "PARTIAL", "UNAVAILABLE"].includes(String(value.status)) ||
    typeof value.currency !== "string" ||
    !/^[A-Z]{3}$/.test(value.currency) ||
    (currency && value.currency !== currency) ||
    value.rangeAmountBasis !== basis ||
    value.feeAmountBasis !== "REQUEST_AMOUNT" ||
    value.quoteRequired !== true ||
    !(value.unavailableReason === null || typeof value.unavailableReason === "string") ||
    !Array.isArray(value.ranges)
  )
    return false;
  let previous: number | null = 0;
  for (const range of value.ranges) {
    if (
      !record(range) ||
      !nonnegative(range.minAmount) ||
      previous === null ||
      range.minAmount < previous ||
      !(
        range.maxAmountExclusive === null ||
        (nonnegative(range.maxAmountExclusive) && range.maxAmountExclusive > range.minAmount)
      ) ||
      typeof range.available !== "boolean" ||
      (range.available
        ? !expression(range.fee) || !(range.fee.minimum === null || expression(range.fee.minimum))
        : range.fee !== null) ||
      (value.status === "AVAILABLE" && (!range.available || range.minAmount !== previous))
    )
      return false;
    previous = range.maxAmountExclusive;
  }
  return value.status !== "AVAILABLE" || (value.ranges.length > 0 && previous === null);
}

/** Older catalogs can omit fees; malformed pricing must never turn into a free tariff. */
export function validCatalogFees(
  value: unknown,
  currency?: string,
): value is CatalogFees | undefined {
  return (
    value === undefined ||
    (record(value) &&
      value.environment === "LIVE" &&
      schedule(value.collection, "GROSS_AMOUNT", currency) &&
      schedule(value.payout, "REQUEST_AMOUNT", currency) &&
      (value.collection as CatalogFeeSchedule).currency ===
        (value.payout as CatalogFeeSchedule).currency)
  );
}

/** Format tariff metadata only. Never select a tier or calculate a payment charge here. */
export function catalogFeeExpression(
  value: CatalogFeeExpression,
  currency: string,
  language = "en",
) {
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 8 });
  const amount = new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
  const terms = [];
  if (value.percentage !== 0) terms.push(`${number.format(value.percentage)}%`);
  if (value.flatFee !== 0) terms.push(`${amount.format(value.flatFee)} ${currency}`);
  return terms.join(" + ") || (language === "fr" ? "Gratuit" : "Free");
}

export function catalogFeeBand(range: CatalogFeeRange, currency: string, language = "en") {
  const number = new Intl.NumberFormat(language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
  return range.maxAmountExclusive === null
    ? `≥ ${number.format(range.minAmount)} ${currency}`
    : `${number.format(range.minAmount)} ≤ ${language === "fr" ? "montant" : "amount"} < ${number.format(range.maxAmountExclusive)} ${currency}`;
}
