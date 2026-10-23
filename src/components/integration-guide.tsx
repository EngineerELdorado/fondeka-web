"use client";
import dynamic from "next/dynamic";
import { Code2, Download } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { businessApiDocsRoot } from "@/lib/business-api-docs";
import type { ApiEnvironment } from "@/lib/types";
import release from "../../public/docs/business-api/release.json";
import { Loading } from "./ui";

const Documentation = dynamic(() => import("./business-api-documentation"), {
  loading: () => <Loading rows={3} />,
});

export function IntegrationGuide({ environment = "LIVE" }: { environment?: ApiEnvironment }) {
  const { t } = useI18n();
  const { values, update } = useUrlState();
  const expanded = values.get("guide") === "1";
  return (
    <section
      className="api-docs"
      aria-label={t("Business API documentation", "Documentation de l’API Business")}
    >
      <button
        className="api-docs-toggle"
        onClick={() => update({ guide: expanded ? null : 1 })}
        aria-expanded={expanded}
        aria-controls="integration-guide"
      >
        <span className="tool-icon blue">
          <Code2 size={21} />
        </span>
        <span>
          <strong>{t("Fondeka Business API", "API Business Fondeka")}</strong>
          <small>
            {t("Quickstart, guides and API reference", "Démarrage, guides et référence API")}
          </small>
        </span>
        <span className="count-pill">v{release.version}</span>
        <span className="api-docs-toggle-mark" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>
      <div className="api-docs-downloads">
        <code>{release.baseUrl}</code>
        <a
          className="button secondary small"
          href={`${businessApiDocsRoot}/openapi.v1.json`}
          download="fondeka-business-openapi.v1.json"
        >
          <Download size={14} />
          {t("OpenAPI v1", "OpenAPI v1")}
        </a>
        <a
          className="button secondary small"
          href={`${businessApiDocsRoot}/postman.v1.json`}
          download="fondeka-business-postman.v1.json"
        >
          <Download size={14} />
          {t("Postman · Sandbox", "Postman · Sandbox")}
        </a>
      </div>
      <div id="integration-guide" hidden={!expanded}>
        {expanded && <Documentation environment={environment} />}
      </div>
    </section>
  );
}
