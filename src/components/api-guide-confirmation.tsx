"use client";
import { useId, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Search, Webhook } from "lucide-react";
import type { GuideLesson } from "@/lib/api-guide-content";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import { ApiGuideEndpoint } from "./api-guide-endpoint";

const modes = ["lookup", "webhook"] as const;
type Mode = (typeof modes)[number];

export function ApiGuideConfirmation({
  examples,
  setup,
}: {
  examples: NonNullable<GuideLesson["confirmation"]>;
  setup: ApiGuideSetup;
}) {
  const { t } = useI18n();
  const { update } = useUrlState();
  const payout = examples.lookup.paymentAction === "BUSINESS_API_PAYOUT";
  const [mode, setMode] = useState<Mode>("lookup");
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const options = [
    {
      id: "lookup" as const,
      icon: Search,
      title: t("Transaction lookup", "Consulter la transaction"),
      from: t("Your server", "Votre serveur"),
      to: "Fondeka",
      badge: "GET",
      description: t(
        "You request the current payment state using its reference.",
        "Vous demandez l’état actuel du paiement avec sa référence.",
      ),
    },
    {
      id: "webhook" as const,
      icon: Webhook,
      title: t("Webhook event", "Événement webhook"),
      from: "Fondeka",
      to: t("Your server", "Votre serveur"),
      badge: t("INCOMING", "ENTRANT"),
      description: t(
        "Fondeka sends your server a signed event when the payment reaches a terminal state.",
        "Fondeka envoie un événement signé à votre serveur lorsque le paiement atteint un état final.",
      ),
    },
  ];
  return (
    <div className="guide-confirmation">
      <div
        className="guide-confirmation-methods"
        role="tablist"
        aria-label={t("Ways to check a payment", "Façons de vérifier un paiement")}
      >
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`${id}-${option.id}`}
            aria-selected={mode === option.id}
            aria-controls={`${id}-panel`}
            tabIndex={mode === option.id ? 0 : -1}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            onClick={() => setMode(option.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - index;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = 1;
              else return;
              event.preventDefault();
              setMode(modes[next]);
              tabs.current[next]?.focus();
            }}
          >
            <span className="guide-confirmation-method-title">
              <option.icon size={20} aria-hidden="true" />
              <strong>{option.title}</strong>
              <code>{option.badge}</code>
              {mode === option.id && <CheckCircle2 size={16} aria-hidden="true" />}
            </span>
            <span className="guide-confirmation-direction">
              {option.from} <ArrowRight size={14} aria-hidden="true" /> {option.to}
            </span>
            <span className="guide-confirmation-description">{option.description}</span>
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`} tabIndex={0}>
        <div className="guide-confirmation-outcomes">
          <h4>
            {t("Read", "Lisez")} <code>{mode === "lookup" ? "status" : "data.status"}</code>
          </h4>
          <dl>
            {mode === "lookup" && (
              <>
                <div>
                  <dt>
                    <code>ACCEPTED</code>
                  </dt>
                  <dd>{t("Queued — keep checking", "En file d’attente — poursuivez le suivi")}</dd>
                </div>
                <div>
                  <dt>
                    <code>PROCESSING</code>
                  </dt>
                  <dd>
                    {t(
                      "Execution started or result unresolved — keep checking",
                      "Exécution commencée ou résultat indéterminé — poursuivez le suivi",
                    )}
                  </dd>
                </div>
              </>
            )}
            <div>
              <dt>
                <code>COMPLETED</code>
              </dt>
              <dd>{t("Payment succeeded", "Paiement réussi")}</dd>
            </div>
            <div>
              <dt>
                <code>FAILED</code>
              </dt>
              <dd>{t("Payment unsuccessful", "Paiement non abouti")}</dd>
            </div>
          </dl>
          <p>
            {payout
              ? t(
                  "Before marking the payout as delivered, match the Business, environment, reference, currency and amounts. HTTP 202 only confirms acceptance.",
                  "Avant de marquer le décaissement comme livré, vérifiez le Business, l’environnement, la référence, la devise et les montants. HTTP 202 confirme uniquement l’acceptation.",
                )
              : t(
                  "Before fulfillment, match the Business, environment, payment reference, currency and settlement amount. HTTP 202 only confirms acceptance.",
                  "Avant de livrer, vérifiez le Business, l’environnement, la référence du paiement, la devise et le montant du règlement. HTTP 202 confirme uniquement l’acceptation.",
                )}
          </p>
        </div>
        <div className="guide-confirmation-note">
          {payout && (
            <p>
              {t("Expected action", "Action attendue")} : <code>BUSINESS_API_PAYOUT</code>.{" "}
              {t("Terminal events", "Événements finaux")} :{" "}
              <code>business_api.payout.completed</code>, <code>business_api.payout.failed</code>,{" "}
              {t(
                "Cancellation and expiry use failed events.",
                "Annulation et expiration utilisent les événements failed.",
              )}
            </p>
          )}
          {mode === "lookup" ? (
            <p>
              {t(
                "Poll the original reference with backoff while ACCEPTED or PROCESSING, including if a webhook is delayed or missed. A fast payment may skip intermediate states between reads. Idempotent replays return the existing payment’s current state. Investigate long-running payments; do not submit a replacement automatically.",
                "Consultez la référence d’origine en espaçant les appels tant que l’état est ACCEPTED ou PROCESSING, notamment si un webhook tarde ou manque. Un paiement rapide peut passer des étapes entre deux consultations. Une relance idempotente retourne l’état actuel du paiement existant. Examinez les paiements longs ; ne créez pas de remplacement automatique.",
              )}
            </p>
          ) : (
            <>
              <p>
                {t(
                  "Verify the signature before trusting data.status. Only COMPLETED and FAILED generate terminal payment events. Neither ACCEPTED nor PROCESSING generates one; use transaction lookup while waiting. Older saved webhook bodies retain their recorded contents across retries.",
                  "Vérifiez la signature avant de vous fier à data.status. Seuls COMPLETED et FAILED génèrent des événements finaux. Ni ACCEPTED ni PROCESSING n’en génère ; consultez la transaction pendant l’attente. Les anciens corps webhook restent inchangés lors des nouvelles tentatives.",
                )}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => update({ doc: "webhooks", lesson: "verify" })}
              >
                {t("Webhook setup & verification", "Configuration et vérification des webhooks")}
                <ArrowRight size={14} />
              </button>
            </>
          )}
          {payout && (
            <p>
              {t("Check", "Vérifiez")}{" "}
              <code>{mode === "lookup" ? "refunded" : "data.refunded"}</code>.{" "}
              {t(
                "FAILED alone does not confirm a refund. Lookup returns current state, including a refund after the webhook snapshot. Completion never debits the wallet twice.",
                "FAILED ne confirme pas à lui seul un remboursement. La consultation retourne l’état actuel, y compris un remboursement postérieur au webhook. La confirmation ne débite jamais le portefeuille deux fois.",
              )}
            </p>
          )}
          {payout && (
            <p className="guide-shared-example-note">
              {t(
                "The published lookup and webhook samples below use a collection. Their schemas are shared with payouts; the sample bodies are preserved exactly as published.",
                "Les exemples publiés de consultation et de webhook ci-dessous représentent un encaissement. Leurs schémas sont partagés avec les décaissements ; les corps d’exemple sont conservés exactement tels que publiés.",
              )}
            </p>
          )}
        </div>
        <ApiGuideEndpoint key={mode} example={examples[mode]} setup={setup} />
      </div>
    </div>
  );
}
