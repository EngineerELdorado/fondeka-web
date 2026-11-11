"use client";
import { ChevronDown } from "lucide-react";
import { useI18n, setLanguage } from "@/lib/i18n";
export function LanguageSwitch({ onChange }: { onChange?: (language: "en" | "fr") => void }) {
  const { language, t } = useI18n();
  return (
    <label className="language-switch header-select">
      <span className="sr-only">{t("Language", "Langue")}</span>
      <select
        value={language}
        onChange={(event) => {
          const selected = event.target.value as "en" | "fr";
          setLanguage(selected);
          onChange?.(selected);
        }}
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
      </select>
      <span className="switch-chevron" aria-hidden="true">
        <ChevronDown size={12} strokeWidth={2.5} />
      </span>
    </label>
  );
}
