"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("fondeka:navigation", callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("fondeka:navigation", callback);
  };
}
export function useUrlState() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  const values = new URLSearchParams(search);
  const update = (patch: Record<string, string | number | null>, replace = false) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    const url = window.location.pathname + (next.size ? `?${next}` : "") + window.location.hash;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    window.dispatchEvent(new Event("fondeka:navigation"));
  };
  return { values, update, page: Math.max(0, Number(values.get("page")) || 0) };
}
