"use client";

import { useSyncExternalStore } from "react";
import { paymentLanguage } from "./business-tools-ui";
function subscribe(change: () => void) {
  const observer = new MutationObserver(change);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}
export function usePaymentLanguage() {
  return useSyncExternalStore(
    subscribe,
    () => paymentLanguage(document.documentElement.lang),
    () => "en" as const,
  );
}
