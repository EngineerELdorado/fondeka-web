"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { catalogFeeBand, catalogFeeExpression } from "@/lib/api-catalog-fees";
import { billCatalogQuery } from "@/lib/api-bill-catalog";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import { useApiBillCatalog } from "@/lib/use-api-bill-catalog";
import { useI18n } from "@/lib/i18n";
import { demoMode } from "@/lib/auth";
import { useWorkspace } from "./workspace-provider";
import { Empty, ErrorState, Loading } from "./ui";

const query = billCatalogQuery();

export function ApiGuideBillCatalog({ setup }: { setup: ApiGuideSetup }) {
  const { t, language } = useI18n();
  const { accountKey } = useWorkspace();
  const publicGuide = setup.audience === "public";
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const catalog = useApiBillCatalog(
    query,
    language,
    publicGuide,
    accountKey,
    !setup.loading && !setup.error ? setup.business?.id : undefined,
  );
  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(value);
  const category = (value: string) =>
    ({
      ELECTRICITY: t("Electricity", "Électricité"),
      WATER: t("Water", "Eau"),
      TELEVISION: t("TV", "TV"),
    })[value] || value;
  const products = catalog.data?.products || [];
  const commissions = !publicGuide && catalog.data?.products.some((p) => p.commission);
  if (setup.loading) return <Loading rows={3} />;
  if (setup.error) return <ErrorState message={setup.error} retry={setup.refresh} />;
  return (
    <section
      className="api-bill-catalog"
      aria-label={t("Available API bill products", "Produits de facturation disponibles par API")}
    >
      <div className="api-catalog-context">
        <strong>{t("Available API products", "Produits disponibles par API")}</strong>
        <span className="environment-tag live">LIVE</span>
        <span>
          {publicGuide
            ? t("Standard fees", "Tarifs standards")
            : t("Your account’s fees", "Tarifs de votre compte")}
        </span>
      </div>
      {demoMode && !publicGuide && (
        <p className="api-catalog-demo-prices">
          {t("Illustrative demo pricing", "Tarifs fictifs de démonstration")}
        </p>
      )}
      {notice && <p role="alert">{notice}</p>}
      {catalog.loading ? (
        <Loading rows={3} />
      ) : catalog.error ? (
        <ErrorState message={catalog.error} retry={catalog.refresh} />
      ) : (
        catalog.data && (
          <>
            {!products.length ? (
              <Empty
                title={t("No products available", "Aucun produit disponible")}
                description={t(
                  "No API bill products are currently available for this market.",
                  "Aucun produit API n’est actuellement disponible pour ce marché.",
                )}
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">
                    {t(
                      "Available products, fees and applicable reseller commissions",
                      "Produits disponibles, frais et commissions revendeur applicables",
                    )}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("Product", "Produit")}</th>
                      <th scope="col">{t("Code", "Code")}</th>
                      <th scope="col">{t("Country", "Pays")}</th>
                      <th scope="col">{t("Category", "Catégorie")}</th>
                      <th scope="col">{t("Fee", "Frais")}</th>
                      {commissions && (
                        <th scope="col">
                          {t("Your reseller commission", "Votre commission revendeur")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.code}>
                        <td>
                          <strong className="table-name">{product.displayName}</strong>
                        </td>
                        <td>
                          <div className="api-bill-product-code">
                            <code>{product.code}</code>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`${t("Copy", "Copier")} billProductCode: ${product.code}`}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(product.code);
                                  setCopied(product.code);
                                  setNotice("");
                                } catch {
                                  setNotice(
                                    t(
                                      "Select and copy the product code manually.",
                                      "Sélectionnez et copiez le code produit manuellement.",
                                    ),
                                  );
                                }
                              }}
                            >
                              {copied === product.code ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td>{product.countryCodes.join(" · ") || "—"}</td>
                        <td>{category(product.category)}</td>
                        <td>
                          {!product.feeSchedule || product.feeSchedule.status === "UNAVAILABLE" ? (
                            <span className="muted">
                              {t("Pricing unavailable", "Tarif indisponible")}
                            </span>
                          ) : (
                            product.feeSchedule.ranges.map((range) => (
                              <div className="api-bill-fee-rule" key={range.minAmount}>
                                {range.available && range.fee ? (
                                  <strong>
                                    {range.fee.minimum ? t("Higher of ", "Le plus élevé de ") : ""}
                                    {catalogFeeExpression(
                                      range.fee,
                                      product.feeSchedule!.currency,
                                      language,
                                    )}
                                    {range.fee.minimum && (
                                      <>
                                        {" "}
                                        {t("or", "ou")}{" "}
                                        {catalogFeeExpression(
                                          range.fee.minimum,
                                          product.feeSchedule!.currency,
                                          language,
                                        )}
                                      </>
                                    )}
                                  </strong>
                                ) : (
                                  <span className="muted">{t("Unavailable", "Indisponible")}</span>
                                )}
                                {(product.feeSchedule!.ranges.length > 1 ||
                                  range.minAmount > 0 ||
                                  range.maxAmountExclusive !== null) && (
                                  <small className="table-subtitle">
                                    {catalogFeeBand(range, product.feeSchedule!.currency, language)}
                                  </small>
                                )}
                              </div>
                            ))
                          )}
                        </td>
                        {commissions && (
                          <td>
                            {product.commission ? (
                              <>
                                {number(product.commission.percentage)} %
                                <small className="table-subtitle">
                                  {product.commission.basis === "NET_AMOUNT"
                                    ? t("of the net bill amount", "du montant net de la facture")
                                    : t("of Fondeka’s revenue", "des revenus de Fondeka")}
                                </small>
                                {product.commission.maxPoints !== undefined && (
                                  <small className="table-subtitle">
                                    {t("Cap", "Plafond")} : {number(product.commission.maxPoints)}{" "}
                                    {t("points", "points")}
                                  </small>
                                )}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="api-bill-catalog-note">
              {publicGuide
                ? t(
                    "Sign in to see account pricing and eligible reseller commissions.",
                    "Connectez-vous pour voir les tarifs de votre compte et les commissions revendeur applicables.",
                  )
                : commissions
                  ? t(
                      "Commissions are earned as reseller points on eligible completed purchases. They do not reduce the wallet debit.",
                      "Les commissions sont acquises en points revendeur sur les achats terminés éligibles. Elles ne réduisent pas le débit du portefeuille.",
                    )
                  : t(
                      "Fees apply to this account and are confirmed at payment.",
                      "Les frais s’appliquent à ce compte et sont confirmés au paiement.",
                    )}
            </p>
          </>
        )
      )}
    </section>
  );
}
