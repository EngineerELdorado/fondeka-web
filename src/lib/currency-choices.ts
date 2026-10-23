export function currencyChoices(payload: unknown, existing: string[] = []): string[] {
  const p = payload as Record<string, unknown> | null;
  const rows = Array.isArray(payload)
    ? payload
    : ["content", "currencies", "currencyProducts", "products", "data"]
        .map((k) => p?.[k])
        .find(Array.isArray) || [];
  const values = (rows as unknown[]).flatMap((value) => {
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
