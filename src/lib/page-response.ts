const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Spring Data VIA_DTO nests page metadata. Keep one list shape throughout the portal. */
export function normalizePageResponse<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.content) || !("page" in source)) return value;
  const metadata = source.page as Record<string, unknown> | null;
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !nonNegativeInteger(metadata.number) ||
    !nonNegativeInteger(metadata.size) ||
    metadata.size === 0 ||
    !nonNegativeInteger(metadata.totalElements) ||
    !nonNegativeInteger(metadata.totalPages)
  )
    throw new Error("Fondeka returned invalid pagination. Refresh and try again.");
  const { number, size, totalElements, totalPages } = metadata;
  return {
    ...source,
    number,
    size,
    totalElements,
    totalPages,
    first: number === 0,
    last: number >= totalPages - 1,
    empty: source.content.length === 0,
  } as T;
}
