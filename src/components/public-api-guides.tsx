"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, MessageCircleQuestionMark, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { IntegrationGuide } from "./integration-guide";

function PublicGuideFaq() {
  const { t, language } = useI18n();
  const [showPrompt, setShowPrompt] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowPrompt(false), 9000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <a
      className="public-api-faq"
      href={`https://www.fondeka.com/docs/faq?lang=${language}`}
      aria-label={t("Got questions? Read the API FAQ", "Des questions ? Consultez la FAQ API")}
      data-prompt={showPrompt}
    >
      <span className="public-api-faq-prompt" aria-hidden="true">
        <strong>{t("Got questions?", "Des questions ?")}</strong>
        <span>
          {t("Find answers in the FAQ", "Trouvez vos réponses dans la FAQ")}
          <ArrowUpRight size={14} />
        </span>
      </span>
      <span className="public-api-faq-button" aria-hidden="true">
        <MessageCircleQuestionMark size={23} />
        <span>FAQ</span>
        <span className="public-api-faq-sparkle">
          <Sparkles size={13} />
        </span>
      </span>
    </a>
  );
}

export function PublicApiGuides({ billPaymentsApiReady }: { billPaymentsApiReady: boolean }) {
  const { t } = useI18n();

  return (
    <main id="main-content" className="public-api-guides">
      <h1 className="sr-only">{t("API guides", "Guides API")}</h1>
      <IntegrationGuide
        setup={{
          audience: "public",
          environment: "SANDBOX",
          publicBillPaymentsReady: billPaymentsApiReady,
          loading: false,
          refresh: () => {},
        }}
      />
      <PublicGuideFaq />
    </main>
  );
}
