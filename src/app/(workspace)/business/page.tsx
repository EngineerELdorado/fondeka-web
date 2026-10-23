"use client";
import { BusinessToolLink as Link } from "@/components/business-tool-link";
import { ArrowUpRight } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { BusinessToolsGate } from "@/components/business-tools-provider";
import { businessTools } from "@/components/business-tools-screen";
import { OwnerOverview } from "@/components/owner-overview";

export default function Business() {
  const { t, language } = useI18n();
  return (
    <>
      <PageHeading
        title={t("Business", "Business")}
        description={t(
          "Your tools to collect, sell and build with Fondeka.",
          "Vos outils pour encaisser, vendre et développer avec Fondeka.",
        )}
      />
      <div className="tools-grid business-tools-grid business-home-tools">
        {businessTools.map(
          ({ icon: Icon, title, titleFr, description, descriptionFr, href, color }) => (
            <Link href={href} key={href} className="tool-card">
              <span className={`tool-icon ${color}`}>
                <Icon size={25} />
              </span>
              <h3>{language === "fr" ? titleFr : title}</h3>
              <p>{language === "fr" ? descriptionFr : description}</p>
              <ArrowUpRight className="tool-arrow" size={20} />
            </Link>
          ),
        )}
      </div>
      <BusinessToolsGate destination="/business">
        <OwnerOverview />
      </BusinessToolsGate>
    </>
  );
}
