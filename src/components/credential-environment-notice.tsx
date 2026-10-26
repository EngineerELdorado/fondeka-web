"use client";

import { FlaskConical, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ApiEnvironment } from "@/lib/types";

export function CredentialEnvironmentNotice({ environment }: { environment: ApiEnvironment }) {
  const { t } = useI18n();
  const sandbox = environment === "SANDBOX";
  const Icon = sandbox ? FlaskConical : ShieldCheck;
  return (
    <section
      className={`credential-environment-notice ${environment.toLowerCase()}`}
      aria-label={t("API key environment", "Environnement de la clé API")}
    >
      <div className="credential-environment-heading">
        <Icon size={18} aria-hidden="true" />
        <strong>{environment}</strong>
        {!sandbox && <span>{t("Real payments", "Paiements réels")}</span>}
      </div>
      <p>
        {sandbox
          ? t("Virtual funds only.", "Fonds virtuels uniquement.")
          : t("Uses real money.", "Utilise de l’argent réel.")}
      </p>
    </section>
  );
}
