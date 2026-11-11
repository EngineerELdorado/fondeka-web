"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, guideThemeStorageKey, readTheme, themeStorageKeyForPath } from "@/lib/theme";

export function ThemeController() {
  const pathname = usePathname();

  useEffect(() => {
    const key = themeStorageKeyForPath(pathname);
    applyTheme(readTheme(pathname), key === guideThemeStorageKey ? 3000 : 900);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === key) applyTheme(readTheme(pathname));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [pathname]);

  return null;
}
