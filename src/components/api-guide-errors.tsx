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
              "HTTP 202 accepts the payment. Read resultingStatus: FAILED reports a failureCode; PROCESSING remains unresolved with no terminal webhook.",
              "HTTP 202 accepte le paiement. Consultez resultingStatus : FAILED fournit un failureCode ; PROCESSING reste indéterminé sans webhook final.",
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
            <ol
              className="guide-error-lifecycle"
              aria-label={t(
                "Request outcome and payment state",
                "Résultat de la requête et état du paiement",
              )}
            >
              <li>
                <h5>
                  <span aria-hidden="true">1</span>
                  {t("When you submit the payment", "Lors de l’envoi du paiement")}
                </h5>
                <dl>
                  <div>
                    <dt>{t("HTTP response", "Réponse HTTP")}</dt>
                    <dd>
                      <code>{t("202 Accepted", "202 Accepté")}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Payment status", "État du paiement")}</dt>
                    <dd>
                      <code className="queued">ACCEPTED</code>
                    </dd>
                  </div>
                </dl>
                <p>
                  {t(
                    "A new payment is queued for execution. An idempotent replay returns its existing state instead; it does not reset the payment to ACCEPTED.",
                    "Un nouveau paiement est en file d’attente d’exécution. Une relance idempotente retourne son état actuel ; elle ne le remet pas à ACCEPTED.",
                  )}
                </p>
              </li>
              <li>
                <h5>
                  <span aria-hidden="true">2</span>
                  {t("When execution starts", "Lorsque l’exécution commence")}
                </h5>
                <dl>
                  <div>
                    <dt>{t("Payment status", "État du paiement")}</dt>
                    <dd>
                      <code className="pending">PROCESSING</code>
                    </dd>
                  </div>
                </dl>
                <p>
                  {t(
                    "The worker has started the payment. Keep polling the same reference; this is still awaiting an outcome.",
                    "Le traitement du paiement a commencé. Poursuivez le suivi de la même référence ; le résultat reste en attente.",
                  )}
                </p>
              </li>
              <li>
                <h5>
                  <span aria-hidden="true">3</span>
                  {t(
                    "Later, when you look up the payment",
                    "Plus tard, lors de la consultation du paiement",
                  )}
                </h5>
                <small>
                  <code>GET /transactions/&#123;reference&#125;</code>
                </small>
                <dl>
                  <div>
                    <dt>{t("HTTP response", "Réponse HTTP")}</dt>
                    <dd>
                      <code>200 OK</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("Payment status", "État du paiement")}</dt>
                    <dd>
                      <code className={active.resultingStatus === "FAILED" ? "failure" : "pending"}>
                        {active.resultingStatus}
                      </code>
                    </dd>
                  </div>
                  {active.resultingStatus === "FAILED" && (
                    <div>
                      <dt>
                        <code>failureCode</code>
                      </dt>
                      <dd>
                        <code>{active.errorCode}</code>
                      </dd>
                    </div>
                  )}
                </dl>
                <p>
                  {active.resultingStatus === "FAILED"
                    ? t(
                        "HTTP 200 means the lookup succeeded. The returned payment has FAILED in this simulation.",
                        "HTTP 200 signifie que la consultation a réussi. Le paiement retourné est FAILED dans cette simulation.",
                      )
                    : t(
                        "HTTP 200 means the lookup succeeded. This fixture stays PROCESSING while awaiting confirmations. Poll the same reference with backoff.",
                        "HTTP 200 signifie que la consultation a réussi. Ce scénario reste PROCESSING en attendant les confirmations. Espacez les consultations de la même référence.",
                      )}
                </p>
              </li>
            </ol>
          )}
          {!("httpStatus" in active) && (
            <p className="guide-error-webhook-note">
              {active.resultingStatus === "FAILED"
                ? t(
                    "The signed failed-payment webhook reports the same final status and failureCode. ACCEPTED and PROCESSING do not generate terminal events. Worker timing means you may not observe every intermediate state.",
                    "Le webhook signé d’échec de paiement indique le même état final et le même failureCode. ACCEPTED et PROCESSING ne génèrent pas d’événement final. Selon la vitesse du traitement, certaines étapes intermédiaires peuvent ne pas être observées.",
                  )
                : t(
                    "No completed/failed webhook or failureCode is produced. There is no resolve-pending simulation endpoint; use a fresh intent to test a separate terminal outcome.",
                    "Aucun webhook de réussite ou d’échec ni failureCode n’est produit. Aucun endpoint ne permet de résoudre cette attente simulée ; utilisez une nouvelle intention pour tester un résultat final distinct.",
                  )}
            </p>
          )}
          {!("httpStatus" in active) && (
            <p>
              {endpoint.path.endsWith("/payouts")
                ? active.resultingStatus === "PROCESSING"
                  ? t(
                      "The original virtual gross debit stays reserved. There is no automatic refund.",
                      "Le débit brut virtuel d’origine reste réservé. Aucun remboursement automatique n’a lieu.",
                    )
                  : t(
                      "Acceptance debits the virtual gross amount once. Failure refunds it once only when the refund policy saved at acceptance permits it. Check PAYOUT_DEBIT and any linked PAYOUT_REFUND in the sandbox wallet entries; the payment response has no refund flag.",
                      "L’acceptation débite une fois le montant brut virtuel. L’échec le rembourse une seule fois si la politique enregistrée à l’acceptation le permet. Vérifiez PAYOUT_DEBIT et tout PAYOUT_REFUND associé dans les écritures sandbox ; la réponse du paiement n’a pas d’indicateur de remboursement.",
                    )
                : active.resultingStatus === "PROCESSING"
                  ? t(
                      "The collection receives no wallet credit while confirmations remain pending.",
                      "L’encaissement ne crédite pas le portefeuille tant que les confirmations restent en attente.",
                    )
                  : t(
                      "A failed collection credits nothing to the wallet.",
                      "Un encaissement échoué ne crédite pas le portefeuille.",
                    )}
            </p>
          )}
          {active.errorCode === "CRYPTO_INVOICE_EXPIRED" && (
            <p>
              {t(
                "cryptoDetails.expiresAt matches the scheduled sandbox expiry. The final backend status remains authoritative. These instructions are unpayable fixtures; never send real crypto to them.",
                "cryptoDetails.expiresAt correspond à l’expiration sandbox prévue. L’état final du backend fait foi. Ces instructions sont des données de test non payables ; n’y envoyez jamais de vraies cryptos.",
              )}
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
                "Retry an accepted payment with its original idempotency key, normalized payload and processing code. Changing the code or payload on that key returns 409 IDEMPOTENCY_CONFLICT. A separate outcome needs a fresh intent and key. Replays create no extra debit, credit, refund or terminal event.",
                "Relancez un paiement accepté avec sa clé d’idempotence, son contenu normalisé et son code de traitement d’origine. Modifier le code ou le contenu avec cette clé renvoie 409 IDEMPOTENCY_CONFLICT. Un résultat distinct nécessite une nouvelle intention et une nouvelle clé. Les relances ne créent aucun débit, crédit, remboursement ou événement final supplémentaire.",
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
          "A failed poll or network timeout does not establish payment failure. HTTP status/statusCode are numbers; payment status is ACCEPTED, PROCESSING, COMPLETED or FAILED.",
          "Un échec de consultation ou un délai réseau ne confirme pas l’échec du paiement. status/statusCode HTTP sont des nombres ; le status du paiement vaut ACCEPTED, PROCESSING, COMPLETED ou FAILED.",
        )}
      </p>
    </div>
  );
}
