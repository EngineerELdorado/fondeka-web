function currencyRows(payload: unknown): unknown[] {
  const p = payload as Record<string, unknown> | null;
  return Array.isArray(payload)
    ? payload
    : ["content", "currencies", "currencyProducts", "products", "data"]
        .map((k) => p?.[k])
        .find(Array.isArray) || [];
}

export type CurrencyPresentation = { logoUrl?: string; displayName?: string; countryCode?: string };
/** Reuse the same currency-product media as the mobile wallet selector. */
export function currencyPresentations(payload: unknown) {
  const result = new Map<string, CurrencyPresentation>();
  for (const row of currencyRows(payload)) {
    if (!row || typeof row !== "object") continue;
    const value = row as Record<string, unknown>;
    const code = String(value.currency || value.code || value.currencyCode || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) continue;
    const countries = Array.isArray(value.countryCodes) ? value.countryCodes : [];
    result.set(code, {
      logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : undefined,
      displayName: typeof value.displayName === "string" ? value.displayName : undefined,
      countryCode:
        countries.length === 1 &&
        typeof countries[0] === "string" &&
        /^[A-Z]{2}$/.test(countries[0])
          ? countries[0]
          : undefined,
    });
  }
  return result;
}

export function currencyChoices(payload: unknown, existing: string[] = []): string[] {
  const values = currencyRows(payload).flatMap((value) => {
    if (typeof value === "string")
      return /^[A-Z]{3}$/.test(value.toUpperCase()) ? [value.toUpperCase()] : [];
    if (!value || typeof value !== "object") return [];
    const r = value as Record<string, unknown>;
    const code = String(r.currency || r.code || r.currencyCode || "").toUpperCase();
    return r.active !== false &&
      r.enabled !== false &&
      r.walletEnabled !== false &&
      /^[A-Z]{3}$/.test(code)
      ? [code]
      : [];
  });
  return [...new Set([...existing.filter((c) => /^[A-Z]{3}$/.test(c)), ...values])];
}
