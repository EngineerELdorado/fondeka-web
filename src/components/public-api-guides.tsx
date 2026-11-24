"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, MessageCircleQuestionMark, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { IntegrationGuide } from "./integration-guide";
import type { BillPaymentApiAvailability } from "@/lib/types";
import { normalizeBillPaymentAvailability } from "@/lib/api-guide-availability";

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
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t(
        "Got questions? Read the API FAQ (opens in a new tab)",
        "Des questions ? Consultez la FAQ API (s’ouvre dans un nouvel onglet)",
      )}
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

export function PublicApiGuides({
  billPaymentsApiAvailability,
}: {
  billPaymentsApiAvailability: BillPaymentApiAvailability;
}) {
  const { t } = useI18n();
  const [availability, setAvailability] = useState(billPaymentsApiAvailability);

  useEffect(() => {
    let active = true;
    let pending: AbortController | undefined;
    async function refreshAvailability() {
      if (pending || document.visibilityState === "hidden") return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch("/api/public/business-api/guide-availability", {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const status = await response.json();
        if (active)
          setAvailability(
            normalizeBillPaymentAvailability(
              status?.billPaymentsApiReady,
              status?.billPaymentsApiAvailability,
            ),
          );
      } catch {
        // Keep the last successful flags during a temporary outage and retry on the next refresh.
      } finally {
        window.clearTimeout(timeout);
        pending = undefined;
      }
    }
    void refreshAvailability();
    const interval = window.setInterval(refreshAvailability, 60000);
    window.addEventListener("focus", refreshAvailability);
    document.addEventListener("visibilitychange", refreshAvailability);
    return () => {
      active = false;
      pending?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAvailability);
      document.removeEventListener("visibilitychange", refreshAvailability);
    };
  }, []);

  return (
    <main id="main-content" className="public-api-guides">
      <h1 className="sr-only">{t("API guides", "Guides API")}</h1>
      <IntegrationGuide
        setup={{
          audience: "public",
          environment: "SANDBOX",
          publicBillPaymentsAvailability: availability,
          loading: false,
          refresh: () => {},
        }}
      />
      <PublicGuideFaq />
    </main>
  );
}
