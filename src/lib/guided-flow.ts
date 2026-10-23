export type FlowErrors = Record<string, string | undefined>;
export type FlowStep<T> = { id: string; validate?: (value: T) => FlowErrors };
export const flowDraftPrefix = "fondeka-flow:";
export function resolveFlowStep<T>(steps: FlowStep<T>[], requested: string | null, value: T) {
  const wanted = Math.max(
    0,
    steps.findIndex((step) => step.id === requested),
  );
  for (let index = 0; index < wanted; index++)
    if (Object.values(steps[index].validate?.(value) || {}).some(Boolean)) return index;
  return wanted;
}
export function validateFlow<T>(steps: FlowStep<T>[], value: T) {
  for (let index = 0; index < steps.length; index++) {
    const errors = steps[index].validate?.(value) || {};
    if (Object.values(errors).some(Boolean)) return { index, errors };
  }
}
export function readFlowDraft<T extends object>(
  storage: Pick<Storage, "getItem">,
  key: string,
  initial: T,
  fields: (keyof T)[],
  now = Date.now(),
): T {
  try {
    const raw = storage.getItem(key) || "null";
    if (raw.length > 100000) return initial;
    const saved = JSON.parse(raw);
    if (
      saved?.version !== 1 ||
      !Number.isFinite(saved.at) ||
      now - saved.at > 86400000 ||
      saved.at > now ||
      !saved.value ||
      typeof saved.value !== "object"
    )
      return initial;
    const value = { ...initial };
    for (const field of fields) {
      const next = saved.value[field];
      if (compatibleDraftValue(next, initial[field])) value[field] = next;
    }
    return value;
  } catch {
    return initial;
  }
}
export function writeFlowDraft<T extends object>(
  storage: Pick<Storage, "setItem">,
  key: string,
  value: T,
  fields: (keyof T)[],
) {
  const safe = Object.fromEntries(fields.map((field) => [field, value[field]]));
  const json = JSON.stringify({ version: 1, at: Date.now(), value: safe });
  if (json.length <= 100000) storage.setItem(key, json);
}
export function clearFlowDrafts(keepAccount?: string) {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (
        key.startsWith(flowDraftPrefix) &&
        (!keepAccount || !key.startsWith(flowDraftPrefix + keepAccount + ":"))
      )
        sessionStorage.removeItem(key);
  } catch {
    /* Account recovery still works without browser storage. */
  }
}

function compatibleDraftValue(value: unknown, template: unknown): boolean {
  if (template === null) return value === null;
  if (Array.isArray(template))
    return (
      Array.isArray(value) &&
      value.length <= (template.length || 100) &&
      value.every((item) =>
        template.length ? compatibleDraftValue(item, template[0]) : typeof item === "string",
      )
    );
  if (typeof template === "number") return typeof value === "number" && Number.isFinite(value);
  if (typeof template === "string") return typeof value === "string" && value.length <= 50000;
  if (typeof template === "boolean") return typeof value === "boolean";
  return false;
}
