"use client";

import { Code2, Layers3, Link2, ScanLine, Store } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LoginToolkit() {
  const { t } = useI18n();
  const tools = [
    {
      icon: Link2,
      tone: "blue",
      title: t("Payment links", "Liens de paiement"),
      description: t("Quick collections", "Encaissements rapides"),
    },
    {
      icon: Store,
      tone: "violet",
      title: t("Online Stores", "Boutiques en ligne"),
      description: t("Your storefront", "Votre vitrine"),
    },
    {
      icon: ScanLine,
      tone: "amber",
      title: "POS",
      description: t("Sales in person", "Ventes en personne"),
    },
    {
      icon: Code2,
      tone: "teal",
      title: t("Payments API", "API de paiement"),
      description: t("Build your integration", "Créez votre intégration"),
    },
  ];
  return (
    <div className="login-toolkit">
      <div className="login-toolkit-heading">
        <span>
          <Layers3 size={16} aria-hidden="true" />
          {t("One space. Four tools.", "Un espace. Quatre outils.")}
        </span>
        <span className="login-toolkit-count" aria-hidden="true">
          04
        </span>
      </div>
      <ul>
        {tools.map(({ icon: Icon, tone, title, description }, index) => (
          <li key={tone} data-tool-tone={tone}>
            <span className="login-toolkit-icon">
              <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="login-toolkit-number" aria-hidden="true">
              0{index + 1}
            </span>
            <strong>{title}</strong>
            <small>{description}</small>
          </li>
        ))}
      </ul>
      <span className="login-toolkit-orbit orbit-one" aria-hidden="true" />
      <span className="login-toolkit-orbit orbit-two" aria-hidden="true" />
    </div>
  );
}
