"use client";

import { catalogFeeBand, catalogFeeExample, catalogFeeExpression } from "@/lib/api-catalog-fees";
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
  const candidate = method.fees?.[payout ? "payout" : "collection"];
  const schedule = candidate?.currency === currency ? candidate : undefined;
  const example = catalogFeeExample(schedule);
  const money = (value: number) =>
    `${new Intl.NumberFormat(language, { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value)} ${schedule?.currency || currency}`;
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
          <strong>EXCLUSIVE</strong>{" "}
          {t("adds fees on top of the amount you enter.", "ajoute les frais au montant saisi.")}
          {example && (
            <>
              {" "}
              {t(
                `Example: enter ${money(example.exclusive.amount)}, add ${money(example.exclusive.fee)} in fees, and the total is ${money(example.exclusive.total)}.`,
                `Exemple : pour ${money(example.exclusive.amount)}, on ajoute ${money(example.exclusive.fee)} de frais, soit ${money(example.exclusive.total)} au total.`,
              )}
            </>
          )}
        </p>
        <p>
          <strong>INCLUSIVE</strong>{" "}
          {t("takes fees out of the amount you enter.", "retire les frais du montant saisi.")}
          {example && (
            <>
              {" "}
              {t(
                `Example: enter ${money(example.inclusive.amount)}, take out ${money(example.inclusive.fee)} in fees, and ${money(example.inclusive.net)} is left for the payment.`,
                `Exemple : sur ${money(example.inclusive.amount)}, on retire ${money(example.inclusive.fee)} de frais. Il reste ${money(example.inclusive.net)} pour le paiement.`,
              )}
            </>
          )}
        </p>
      </details>
    </section>
  );
}
