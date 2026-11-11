"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { IntegrationGuide } from "./integration-guide";

function websiteOrigin() {
  if (!document.referrer) return;
  const referrer = new URL(document.referrer);
  if (["https://www.fondeka.com", "https://fondeka.com"].includes(referrer.origin))
    return referrer.origin;
  if (
    process.env.NODE_ENV === "development" &&
    referrer.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(referrer.hostname)
  )
    return referrer.origin;
}

export function PublicApiGuides({
  embedded,
  billPaymentsApiReady,
}: {
  embedded: boolean;
  billPaymentsApiReady: boolean;
}) {
  const content = useRef<HTMLElement>(null);
  const { t, language } = useI18n();
  const { values } = useUrlState();
  const doc = values.get("doc");
  const lesson = values.get("lesson");

  useEffect(() => {
    const element = content.current;
    if (!embedded || !element || window.parent === window) return;
    const origin = websiteOrigin();
    if (!origin) return;
    const send = () =>
      window.parent.postMessage(
        {
          type: "fondeka:public-api-guides",
          height: Math.ceil(element.getBoundingClientRect().height),
          doc,
          lesson,
        },
        origin,
      );
    send();
    const observer = new ResizeObserver(send);
    observer.observe(element);
    const measure = (event: MessageEvent) => {
      if (
        event.origin === origin &&
        event.source === window.parent &&
        event.data === "fondeka:public-api-guides:measure"
      )
        send();
    };
    window.addEventListener("message", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("message", measure);
    };
  }, [embedded, doc, lesson]);

  return (
    <main
      id="main-content"
      ref={content}
      className={embedded ? "public-api-guides embedded" : "public-api-guides"}
    >
      {!embedded && (
        <header className="public-api-guides-heading">
          <h1>{t("API guides", "Guides API")}</h1>
          <a
            className="button secondary"
            href={`https://www.fondeka.com/docs/faq?lang=${language}`}
          >
            {t("API FAQ", "FAQ API")}
          </a>
        </header>
      )}
      <IntegrationGuide
        setup={{
          audience: "public",
          environment: "SANDBOX",
          publicBillPaymentsReady: billPaymentsApiReady,
          loading: false,
          refresh: () => {},
        }}
      />
    </main>
  );
}
