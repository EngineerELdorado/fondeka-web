export type Theme = "dark" | "light";

export const defaultTheme: Theme = "light";
export const themeStorageKey = "fondeka-business-theme";
export const themeChangeEvent = "fondeka:theme-change";
const publicGuidesPath = "/api-guides";

export function resolveTheme(value: unknown, pathname = ""): Theme {
  if (value === "dark" || value === "light") return value;
  return pathname === publicGuidesPath ? "dark" : defaultTheme;
}

// Restore the saved preference before painting, using the page default when absent.
export const themeInitScript = `
(function () {
  var theme = window.location.pathname === ${JSON.stringify(publicGuidesPath)} ? "dark" : ${JSON.stringify(defaultTheme)};
  try {
    var saved = window.localStorage.getItem(${JSON.stringify(themeStorageKey)});
    if (saved === "dark" || saved === "light") theme = saved;
  } catch (error) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;
