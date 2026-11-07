"use client";
import { useI18n } from "@/lib/i18n";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main-content" className="full-loading">
      <h1>{t("Let’s give that another try.", "Essayons encore une fois.")}</h1>
      <p>{t("We couldn’t open this page.", "Nous n’avons pas pu ouvrir cette page.")}</p>
      <button type="button" className="button primary" onClick={retry}>
        <span>{t("Try again", "Essayer à nouveau")}</span>
      </button>
    </main>
  );
}
