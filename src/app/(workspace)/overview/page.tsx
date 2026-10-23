"use client";
import { BusinessToolLink as Link } from "@/components/business-tool-link";
import { ArrowRight, ArrowUpRight, Plus, Zap } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { PlatformGraphic } from "@/components/platform-graphic";
import { OwnerOverview } from "@/components/owner-overview";
import { BusinessToolsGate } from "@/components/business-tools-provider";
import { businessTools } from "@/components/business-tools-screen";
import { useI18n } from "@/lib/i18n";

export default function Overview() {
  const { t, language } = useI18n();
  return (
    <>
      <PageHeading
        mobileTitle={t("Overview", "Vue d’ensemble")}
        eyebrow={t("YOUR WORKSPACE", "VOTRE ESPACE")}
        title={t("Business, without boundaries.", "Votre entreprise, sans frontières.")}
        description={t(
          "Manage your commerce, payments, and integrations in one place.",
          "Gérez votre commerce, vos paiements et vos intégrations au même endroit.",
        )}
      >
        <Link
          className="button primary"
          href="/payment-requests?new=1"
          aria-label={t("Create payment request", "Créer une demande de paiement")}
        >
          <Plus size={17} />
          {t("Request a payment", "Demander un paiement")}
        </Link>
      </PageHeading>
      <div className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-kicker">
            <span />
            {t("THE FONDEKA BUSINESS PLATFORM", "LA PLATEFORME FONDEKA BUSINESS")}
          </span>
          <h2>
            {t("Your business.", "Votre entreprise.")}
            <br />
            {t("Fully connected.", "Entièrement connectée.")}
          </h2>
          <p>
            {t(
              "From your storefront to your next integration,",
              "De votre boutique à votre prochaine intégration,",
            )}
            <br />
            {t("bring every part of your business together.", "réunissez toutes vos activités.")}
          </p>
          <div className="welcome-actions">
            <Link href="/pos" className="button cream">
              {t("Open point of sale", "Ouvrir le POS")}
              <ArrowRight size={16} />
            </Link>
            <Link href="/developers/guides" className="welcome-secondary">
              {t("Explore the API", "Découvrir l’API")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <PlatformGraphic />
      </div>
      <div className="section-heading">
        <div>
          <h2>{t("Your business toolkit", "Vos outils Business")}</h2>
          <p className="muted">
            {t(
              "Four tools. One account-level activation.",
              "Quatre outils. Une activation pour votre compte.",
            )}
          </p>
        </div>
        <span className="quiet-label">
          <Zap size={14} />
          {t("Made for business", "Pensé pour votre activité")}
        </span>
      </div>
      <div className="tools-grid business-tools-grid">
        {businessTools.map(
          ({ icon: Icon, title, titleFr, description, descriptionFr, href, color }) => (
            <Link href={href} key={href} className="tool-card">
              <span className={"tool-icon " + color}>
                <Icon size={23} />
              </span>
              <h3>{language === "fr" ? titleFr : title}</h3>
              <p>{language === "fr" ? descriptionFr : description}</p>
              <ArrowUpRight className="tool-arrow" size={20} />
            </Link>
          ),
        )}
      </div>
      <BusinessToolsGate destination="/overview">
        <OwnerOverview />
      </BusinessToolsGate>
    </>
  );
}
