export type Theme = "dark" | "light";

export const themeStorageKey = "fondeka-business-theme";
export const themeChangeEvent = "fondeka:theme-change";

export function resolveTheme(value: unknown): Theme {
  return value === "light" ? "light" : "dark";
}

// Runs before the page paints so a saved light preference never flashes dark.
export const themeInitScript = `(function(){var theme="dark";try{if(window.localStorage.getItem(${JSON.stringify(themeStorageKey)})==="light")theme="light"}catch(e){}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme})();`;
