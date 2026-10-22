"use client";

import { useSyncExternalStore } from "react";

const mobileQuery = "(max-width: 760px), (max-width: 960px) and (pointer: coarse)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
export function useMobileLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
}
