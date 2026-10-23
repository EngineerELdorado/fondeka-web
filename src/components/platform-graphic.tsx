"use client";
import { useI18n } from "@/lib/i18n";
import { ArrowDownLeft, Code2, Store } from "lucide-react";

export function PlatformGraphic() {
  const { t } = useI18n();
  return (
    <div className="platform-graphic" aria-hidden="true">
      <div className="platform-glow" />
      <svg className="platform-connections" viewBox="0 0 580 330" fill="none">
        <defs>
          <linearGradient
            id="connection-gradient"
            x1="90"
            y1="40"
            x2="500"
            y2="310"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#617bff" />
            <stop offset=".5" stopColor="#58dfb0" />
            <stop offset="1" stopColor="#9d7bff" />
          </linearGradient>
        </defs>
        <path d="M147 82H220Q244 82 244 106V154H337Q360 154 360 178V257H453" />
        <path d="M146 263H207Q230 263 230 240V180Q230 158 253 158H394Q421 158 421 132V81H465" />
        <path
          className="connection-highlight"
          d="M147 82H220Q244 82 244 106V154H337Q360 154 360 178V257H453"
        />
        <circle cx="244" cy="154" r="4" />
        <circle cx="360" cy="257" r="4" />
        <circle cx="421" cy="81" r="4" />
      </svg>
      <div className="platform-core">
        <span className="platform-core-logo">
          <svg viewBox="0 0 60 60" width="34" height="34">
            <rect width="60" height="60" rx="14" fill="#51c98f" />
            <circle cx="40" cy="20" r="10" fill="#092d22" />
          </svg>
        </span>
        <span>
          <strong>Fondeka</strong>
          <small>{t("BUSINESS PLATFORM", "PLATEFORME BUSINESS")}</small>
        </span>
        <span className="platform-core-mark">↗</span>
      </div>
      <div className="platform-node node-store">
        <span>
          <Store size={20} />
        </span>
        <div>
          <strong>Commerce</strong>
          <small>{t("Online & in person", "En ligne et en personne")}</small>
        </div>
        <i />
      </div>
      <div className="platform-node node-payment">
        <span>
          <ArrowDownLeft size={20} />
        </span>
        <div>
          <strong>{t("Payments", "Paiements")}</strong>
          <small>{t("Links & invoices", "Liens et factures")}</small>
        </div>
        <i />
      </div>
      <div className="platform-node node-api">
        <span>
          <Code2 size={20} />
        </span>
        <div>
          <strong>{t("Business API", "API Business")}</strong>
          <small>{t("Built to connect", "Pensée pour connecter")}</small>
        </div>
        <i />
      </div>
      <span className="platform-coordinate coordinate-top">
        {t("01 / CONNECT", "01 / CONNECTER")}
      </span>
      <span className="platform-coordinate coordinate-bottom">
        {t("YOUR BUSINESS. ONE PLATFORM.", "VOTRE ENTREPRISE. UNE PLATEFORME.")}
      </span>
    </div>
  );
}
