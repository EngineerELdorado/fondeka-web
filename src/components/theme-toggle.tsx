"use client";
import { useI18n } from "@/lib/i18n";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  defaultTheme,
  resolveTheme,
  themeChangeEvent,
  themeStorageKeyForPath,
} from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(themeChangeEvent, onChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
  };
}

function getSnapshot() {
  return resolveTheme(document.documentElement.dataset.theme, window.location.pathname);
}

export function ThemeToggle() {
  const { t } = useI18n();

  const theme = useSyncExternalStore(subscribe, getSnapshot, () => defaultTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const title =
    nextTheme === "dark"
      ? t("Switch to dark mode", "Passer en mode sombre")
      : t("Switch to light mode", "Passer en mode clair");
  function toggle() {
    try {
      window.localStorage.setItem(themeStorageKeyForPath(window.location.pathname), nextTheme);
    } catch {
      // The current tab still switches when browser storage is unavailable.
    }
    applyTheme(nextTheme);
  }
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={title}
      title={title}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span>
        {nextTheme === "light" ? t("Light mode", "Mode clair") : t("Dark mode", "Mode sombre")}
      </span>
    </button>
  );
}
