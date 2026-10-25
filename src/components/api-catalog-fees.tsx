"use client";

import { catalogFeeBand, catalogFeeExpression } from "@/lib/api-catalog-fees";
import type { ApiCatalogMethod } from "@/lib/api-catalog";
import type { ApiEnvironment } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { demoMode } from "@/lib/auth";

export function ApiCatalogFees({
  method,
  payout,
  currency,
  environment,
}: {
  method: ApiCatalogMethod;
  payout: boolean;
  currency: string;
  environment: ApiEnvironment;
}) {
  const { t, language } = useI18n();
  if (environment === "SANDBOX")
    return (
      <section
        className="api-catalog-fees api-catalog-fees-sandbox"
        aria-label={t("Sandbox fees", "Frais sandbox")}
      >
        <h4>{t("Sandbox fees", "Frais sandbox")}</h4>
        <p>
          {t(
            "Test payments use synthetic fees. Check the simulated payment result for its fees; LIVE tariffs do not apply here.",
            "Les paiements de test utilisent des frais fictifs. Consultez le résultat simulé pour ses frais ; les tarifs LIVE ne s’appliquent pas ici.",
          )}
        </p>
      </section>
    );
  const schedule = method.fees?.[payout ? "payout" : "collection"];
  const reasons: Record<string, string> = {
    PAYMENT_METHOD_INACTIVE: t("This method is inactive in LIVE.", "Ce moyen est inactif en LIVE."),
    OPERATION_DISABLED: t(
      "This operation is disabled in LIVE.",
      "Cette opération est désactivée en LIVE.",
    ),
    ROUTE_UNAVAILABLE: t(
      "No route is available for this operation and currency.",
      "Aucun routage n’est disponible pour cette opération et cette devise.",
    ),
    FEE_NOT_CONFIGURED: t(
      "Pricing is not configured for this operation and currency.",
      "Aucun tarif n’est configuré pour cette opération et cette devise.",
    ),
    FX_UNAVAILABLE: t(
      "Pricing cannot currently be converted to this currency.",
      "Les tarifs ne peuvent pas être convertis dans cette devise pour le moment.",
    ),
  };
  return (
    <section
      className="api-catalog-fees"
      aria-label={t("LIVE fee schedule", "Grille tarifaire LIVE")}
    >
      <div className="api-catalog-fees-heading">
        <h4>
          {payout
            ? t("Payout fee", "Frais de décaissement")
            : t("Collection fee", "Frais d’encaissement")}
        </h4>
        <span className="environment-tag live">LIVE</span>
        <span>{currency}</span>
      </div>
      {demoMode && (
        <p className="api-catalog-demo-prices">
          {t("Illustrative demo pricing", "Tarifs fictifs de démonstration")}
        </p>
      )}
      {!schedule || schedule.status === "UNAVAILABLE" ? (
        <div className="api-catalog-fees-unavailable" role="status">
          <strong>{t("Pricing unavailable", "Tarif indisponible")}</strong>
          <p>
            {(schedule?.unavailableReason && reasons[schedule.unavailableReason]) ||
              t(
                "No fee schedule is available. This does not mean the payment is free.",
                "Aucune grille tarifaire n’est disponible. Cela ne signifie pas que le paiement est gratuit.",
              )}
          </p>
        </div>
      ) : (
        <>
          {schedule.status === "PARTIAL" && (
            <p className="api-catalog-fees-partial">
              {t(
                "Pricing is unavailable for some amount bands.",
                "Les tarifs sont indisponibles pour certaines tranches.",
              )}
            </p>
          )}
          <table>
            <caption>
              {schedule.rangeAmountBasis === "GROSS_AMOUNT"
                ? t(
                    "Tiers use the gross amount, including fees.",
                    "Les tranches utilisent le montant brut, frais inclus.",
                  )
                : t(
                    "Tiers use the submitted fiat amount.",
                    "Les tranches utilisent le montant fiat soumis.",
                  )}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t("Amount band", "Tranche de montant")}</th>
                <th scope="col">{t("Fee", "Frais")}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.ranges.map((range) => (
                <tr key={range.minAmount}>
                  <td>{catalogFeeBand(range, schedule.currency, language)}</td>
                  <td>
                    {!range.available || !range.fee ? (
                      <span className="muted">{t("Unavailable", "Indisponible")}</span>
                    ) : range.fee.minimum ? (
                      <span className="api-catalog-fee-minimum">
                        <small>{t("Higher of", "Le plus élevé de")}</small>
                        <strong>
                          {catalogFeeExpression(range.fee, schedule.currency, language)}
                        </strong>
                        <small>{t("or", "ou")}</small>
                        <strong>
                          {catalogFeeExpression(range.fee.minimum, schedule.currency, language)}
                        </strong>
                      </span>
                    ) : (
                      <strong>
                        {catalogFeeExpression(range.fee, schedule.currency, language)}
                      </strong>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <details className="api-catalog-fee-details">
        <summary>{t("How to read these fees", "Comprendre ces frais")}</summary>
        <p>
          {t(
            "Percentages apply to the submitted fiat amount: net with EXCLUSIVE, gross with INCLUSIVE. Each lower bound is included; each upper bound is excluded. An open-ended tariff still has payment limits.",
            "Les pourcentages s’appliquent au montant fiat soumis : net avec EXCLUSIVE, brut avec INCLUSIVE. La borne basse est incluse et la borne haute est exclue. Une tranche ouverte reste soumise aux limites de paiement.",
          )}
        </p>
        {payout && (
          <p>
            {t(
              "The recipient, network and funding history can change the final payout route.",
              "Le destinataire, le réseau et l’historique de financement peuvent modifier le routage final du décaissement.",
            )}
          </p>
        )}
      </details>
      <p className="api-catalog-fee-note">
        {t(
          "Indicative account tariff. The server determines final fees and availability, including rounding and routing.",
          "Tarif indicatif de votre compte. Le serveur détermine les frais et la disponibilité définitifs, selon les arrondis et le routage.",
        )}
      </p>
    </section>
  );
}
