"use client";
import { useState } from "react";
import { AlertCircle, Check, FlaskConical, RefreshCw, Search } from "lucide-react";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import {
  processingErrorsFor,
  simulationHeaders,
  type ErrorSimulation,
  type RequestErrorCode,
} from "@/lib/api-error-catalog";
import type { ApiPaymentKind } from "@/lib/api-catalog";
import type { useApiErrorCatalog } from "@/lib/use-api-error-catalog";
import { useI18n } from "@/lib/i18n";
import { useUiText } from "@/lib/use-ui-text";
import { Empty, ErrorState, Loading } from "./ui";

export function ApiGuideErrors({
  data,
  setup,
  kind,
  simulation,
  onSimulation,
  onInspect,
}: {
  data: ReturnType<typeof useApiErrorCatalog>;
  setup?: ApiGuideSetup;
  kind?: ApiPaymentKind;
  simulation?: ErrorSimulation;
  onSimulation: (value?: ErrorSimulation) => void;
  onInspect: (entry: RequestErrorCode) => void;
}) {
  const { t } = useI18n();
  const uiText = useUiText();
  const [stage, setStage] = useState<ErrorSimulation["stage"]>("request");
  const [search, setSearch] = useState("");
  const [inspected, setInspected] = useState<ErrorSimulation>();
  if (setup?.loading || data.loading) return <Loading rows={3} />;
  if (setup?.error) return <ErrorState message={setup.error} retry={setup.refresh} />;
  if (!setup?.business)
    return (
      <Empty
        title={t("Select an owned Business", "Sélectionnez votre Business")}
        description={t(
          "Its error catalog will appear here.",
          "Son catalogue d’erreurs s’affichera ici.",
        )}
      />
    );
  const error = data.error || data.refreshError;
  if (!data.catalog || !data.endpoint || data.invalid)
    return (
      <ErrorState
        message={
          error ||
          t(
            "Couldn’t read this endpoint’s error catalog.",
            "Impossible de lire le catalogue d’erreurs de cet endpoint.",
          )
        }
        retry={() => void data.refetch()}
      />
    );
  const { catalog, endpoint } = data;
  const processing = processingErrorsFor(endpoint, kind);
  const activeStage = stage === "processing" && processing.length ? "processing" : "request";
  const entries = activeStage === "request" ? endpoint.requestErrors : processing;
  const matches = entries.filter((entry) =>
    `${entry.errorCode} ${entry.description} ${uiText(entry.description)}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase().trim()),
  );
  const active =
    entries.find(
      (entry) => inspected?.stage === activeStage && entry.errorCode === inspected.errorCode,
    ) || matches[0];
  const selection: ErrorSimulation | undefined = active && {
    stage: activeStage,
    errorCode: active.errorCode,
  };
  const selectable =
    !error &&
    !!selection &&
    Object.keys(simulationHeaders(catalog, endpoint, selection, kind)).length > 0;
  const selected = simulation?.stage === activeStage && simulation.errorCode === active?.errorCode;
  return (
    <div className="guide-error-catalog">
      <div className="guide-error-catalog-heading">
        <span className={`environment-tag ${catalog.environment.toLowerCase()}`}>
          {catalog.environment}
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Refresh error catalog", "Actualiser le catalogue d’erreurs")}
          onClick={() => void data.refetch()}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {error && <ErrorState message={error} retry={() => void data.refetch()} />}
      {!endpoint.available && (
        <p className="info-box">
          {t(
            "This endpoint is unavailable in the selected environment.",
            "Cet endpoint n’est pas disponible dans l’environnement sélectionné.",
          )}
        </p>
      )}
      <div
        className="guide-error-stage-tabs"
        role="group"
        aria-label={t("Error stage", "Étape de l’erreur")}
      >
        <button
          type="button"
          aria-pressed={activeStage === "request"}
          onClick={() => {
            setStage("request");
            setSearch("");
          }}
        >
          {t("Request rejected", "Requête refusée")} <span>{endpoint.requestErrors.length}</span>
        </button>
        {processing.length > 0 && (
          <button
            type="button"
            aria-pressed={activeStage === "processing"}
            onClick={() => {
              setStage("processing");
              setSearch("");
            }}
          >
            {t("After acceptance", "Après acceptation")} <span>{processing.length}</span>
          </button>
        )}
      </div>
      <p className="guide-error-stage-note">
        {activeStage === "request"
          ? t("Immediate HTTP rejection · errorCode", "Refus HTTP immédiat · errorCode")
          : t(
              "HTTP 202 accepts the payment. Later failures appear in failureCode, through polling and webhooks.",
              "HTTP 202 accepte le paiement. Les échecs ultérieurs apparaissent dans failureCode, par consultation ou webhook.",
            )}
      </p>
      <label className="guide-error-search">
        <Search size={15} aria-hidden="true" />
        <span className="sr-only">{t("Search error codes", "Rechercher des codes d’erreur")}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Search error codes…", "Rechercher des codes d’erreur…")}
        />
      </label>
      <div
        className="guide-error-code-list"
        role="group"
        aria-label={t("Endpoint error codes", "Codes d’erreur de l’endpoint")}
      >
        {matches.map((entry) => (
          <button
            key={entry.errorCode}
            type="button"
            aria-pressed={active?.errorCode === entry.errorCode}
            onClick={() => {
              setInspected({ stage: activeStage, errorCode: entry.errorCode });
              if ("httpStatus" in entry) onInspect(entry);
            }}
          >
            <span>
              {"httpStatus" in entry ? `HTTP ${entry.httpStatus}` : entry.resultingStatus}
            </span>
            <code>{entry.errorCode}</code>
          </button>
        ))}
        {!matches.length && (
          <p className="muted">
            {t("No matching error codes.", "Aucun code d’erreur correspondant.")}
          </p>
        )}
      </div>
      {active && (
        <div className="guide-error-detail">
          <strong>
            <AlertCircle size={16} />
            <code>{active.errorCode}</code>
          </strong>
          <p>{uiText(active.description)}</p>
          {"howToTest" in active && (
            <>
              <h5>{t("How to test", "Comment tester")}</h5>
              <p>{uiText(active.howToTest)}</p>
            </>
          )}
          {!("httpStatus" in active) && (
            <p className="guide-error-result">
              <code>HTTP 202 · PROCESSING</code>
              <span>→</span>
              <code>HTTP 200 · {active.resultingStatus}</code>
              <span>
                failureCode: <code>{active.errorCode}</code>
              </span>
            </p>
          )}
          <button
            type="button"
            className="button secondary small"
            disabled={!selectable}
            onClick={() => onSimulation(selection)}
          >
            {selected ? <Check size={15} /> : <FlaskConical size={15} />}
            {selected
              ? t("Added to example", "Ajouté à l’exemple")
              : t("Use in cURL example", "Utiliser dans l’exemple cURL")}
          </button>
          {!selectable && (
            <small>
              {catalog.environment === "LIVE"
                ? t(
                    "LIVE ignores simulation headers. Test controls are available in SANDBOX only.",
                    "LIVE ignore les en-têtes de simulation. Les contrôles de test sont réservés au SANDBOX.",
                  )
                : t(
                    "This error cannot be simulated here. Follow its testing guidance.",
                    "Cette erreur ne peut pas être simulée ici. Suivez ses indications de test.",
                  )}
            </small>
          )}
        </div>
      )}
      <button
        type="button"
        className="text-button guide-error-reset"
        disabled={!simulation}
        onClick={() => onSimulation(undefined)}
      >
        {t(
          "Normal success · omit simulation header",
          "Succès normal · omettre l’en-tête de simulation",
        )}
      </button>
      {simulation && (
        <p className="guide-error-intent-note">
          {simulation.stage === "request"
            ? t(
                "An immediate simulated rejection creates no payment, changes no wallet and reserves no idempotency key.",
                "Un refus immédiat simulé ne crée aucun paiement, ne modifie aucun portefeuille et ne réserve aucune clé d’idempotence.",
              )
            : t(
                "Keep the original idempotency key and processing code when retrying an accepted payment. A different failure or payload needs a new intent and key. Failed collections credit nothing; failed payouts require checking refunded separately.",
                "Conservez la clé d’idempotence et le code de traitement d’origine pour relancer un paiement accepté. Un autre échec ou corps nécessite une nouvelle intention et une nouvelle clé. Un encaissement échoué ne crédite rien ; pour un décaissement, vérifiez refunded séparément.",
              )}
        </p>
      )}
      {endpoint.additionalRequestErrorsPossible && (
        <p className="muted">
          {t(
            "LIVE policies and providers may return other codes or no failure details. Keep generic error handling.",
            "Les règles LIVE et les fournisseurs peuvent renvoyer d’autres codes ou aucun détail d’échec. Conservez une gestion générique des erreurs.",
          )}
        </p>
      )}
      <p className="guide-error-intent-note">
        {t(
          "A failed poll or network timeout does not establish payment failure. HTTP status/statusCode are numbers; payment status is PROCESSING, COMPLETED or FAILED.",
          "Un échec de consultation ou un délai réseau ne confirme pas l’échec du paiement. status/statusCode HTTP sont des nombres ; le status du paiement vaut PROCESSING, COMPLETED ou FAILED.",
        )}
      </p>
    </div>
  );
}
