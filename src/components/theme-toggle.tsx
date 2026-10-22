"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { defaultTheme, resolveTheme, themeChangeEvent, themeStorageKey } from "@/lib/theme";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeStorageKey && event.key !== null) return;
    const theme = resolveTheme(event.newValue);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    onChange();
  };
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  return resolveTheme(document.documentElement.dataset.theme);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => defaultTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const title = `Switch to ${nextTheme} mode`;
  function toggle() {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    try {
      window.localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // The current tab still switches when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(themeChangeEvent));
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
      <span>{nextTheme === "light" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
