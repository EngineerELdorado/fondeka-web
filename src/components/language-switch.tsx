"use client";
import { useI18n, setLanguage } from "@/lib/i18n";
export function LanguageSwitch() {
  const { language, t } = useI18n();
  return (
    <label className="language-switch">
      <span className="sr-only">{t("Language", "Langue")}</span>
      <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "fr")}>
        <option value="en">EN</option>
        <option value="fr">FR</option>
      </select>
    </label>
  );
}
