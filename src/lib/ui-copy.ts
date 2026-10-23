import french from "./ui-fr.json";
/** Terminology shared across the existing portal views; backend values are never translated for logic. */
export function uiText(
  text: string,
  language = typeof document === "undefined" ? "en" : document.documentElement.lang,
): string {
  return language.startsWith("fr") ? ((french as Record<string, string>)[text] ?? text) : text;
}
