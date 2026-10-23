"use client";
import { useCallback } from "react";
import { usePaymentLanguage } from "./use-payment-language";
export function useI18n() {
  const language = usePaymentLanguage();
  const t = useCallback((en: string, fr: string) => (language === "fr" ? fr : en), [language]);
  return { language, t };
}
export function setLanguage(language: "en" | "fr") {
  document.documentElement.lang = language;
  try {
    localStorage.setItem("fondeka-language", language);
  } catch {
    /* This preference is optional. */
  }
}
