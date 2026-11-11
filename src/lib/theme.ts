export type Theme = "dark" | "light";

export const defaultTheme: Theme = "light";
export const themeStorageKey = "fondeka-business-theme";
export const guideThemeStorageKey = "fondeka-api-guides-theme";
export const themeChangeEvent = "fondeka:theme-change";
const guidePaths = ["/api-guides", "/developers/guides"];

export function themeStorageKeyForPath(pathname: string) {
  return guidePaths.includes(pathname) ? guideThemeStorageKey : themeStorageKey;
}

export function resolveTheme(value: unknown, pathname = "", workspaceTheme?: unknown): Theme {
  if (guidePaths.includes(pathname) && workspaceTheme === "dark") return "dark";
  if (value === "dark" || value === "light") return value;
  return guidePaths.includes(pathname) ? "dark" : defaultTheme;
}

export function readTheme(pathname: string): Theme {
  try {
    const workspaceTheme = window.localStorage.getItem(themeStorageKey);
    const key = themeStorageKeyForPath(pathname);
    const saved = key === themeStorageKey ? workspaceTheme : window.localStorage.getItem(key);
    return resolveTheme(saved, pathname, workspaceTheme);
  } catch {
    return resolveTheme(null, pathname);
  }
}

let transitionTimeout: number | undefined;

export function applyTheme(theme: Theme, duration = 900) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;

  window.clearTimeout(transitionTimeout);
  root.style.setProperty("--theme-transition-duration", `${duration}ms`);
  root.dataset.themeTransition = "true";
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(themeChangeEvent));
  transitionTimeout = window.setTimeout(() => delete root.dataset.themeTransition, duration + 100);
}

// Restore the saved preference before painting, using the page default when absent.
export const themeInitScript = `
(function () {
  var guides = ${JSON.stringify(guidePaths)}.includes(window.location.pathname);
  var theme = guides ? "dark" : ${JSON.stringify(defaultTheme)};
  try {
    var workspace = window.localStorage.getItem(${JSON.stringify(themeStorageKey)});
    var saved = guides ? window.localStorage.getItem(${JSON.stringify(guideThemeStorageKey)}) : workspace;
    if (guides && workspace === "dark") theme = "dark";
    else if (saved === "dark" || saved === "light") theme = saved;
  } catch (error) {}
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;
