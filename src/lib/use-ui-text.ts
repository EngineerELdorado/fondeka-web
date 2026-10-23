"use client";
import { useCallback } from "react";
import { usePaymentLanguage } from "./use-payment-language";
import { uiText } from "./ui-copy";
/** Match the server locale during hydration, then subscribe to the selected locale. */
export function useUiText() {
  const language = usePaymentLanguage();
  return useCallback((text: string) => uiText(text, language), [language]);
}
