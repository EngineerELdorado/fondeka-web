export type Theme = "dark" | "light";

export const defaultTheme: Theme = "light";
export const themeStorageKey = "fondeka-business-theme";
export const themeChangeEvent = "fondeka:theme-change";

export function resolveTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : defaultTheme;
}

// Restore the saved preference before the page paints, falling back to light.
export const themeInitScript = `(function(){var theme=${JSON.stringify(defaultTheme)};try{if(window.localStorage.getItem(${JSON.stringify(themeStorageKey)})==="dark")theme="dark"}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme})();`;
