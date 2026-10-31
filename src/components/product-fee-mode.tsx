"use client";
import { useI18n } from "@/lib/i18n";

export function ProductFeeMode({
  value,
  onChange,
}: {
  value: "INHERIT" | "EXCLUSIVE" | "INCLUSIVE";
  onChange: (value: "INHERIT" | "EXCLUSIVE" | "INCLUSIVE") => void;
}) {
  const { t } = useI18n();
  return (
    <label>
      {t("Payment fees", "Frais de paiement")}
      <select
        name="feeApplicationMode"
        value={value}
        onChange={(event) => onChange(event.target.value as "INHERIT" | "EXCLUSIVE" | "INCLUSIVE")}
      >
        <option value="INHERIT">
          {t("Use current fee policy", "Conserver la politique de frais actuelle")}
        </option>
        <option value="EXCLUSIVE">
          {t("EXCLUSIVE · Added to buyer total", "EXCLUSIVE · Ajoutés au total de l’acheteur")}
        </option>
        <option value="INCLUSIVE">
          {t("INCLUSIVE · Included in price", "INCLUSIVE · Inclus dans le prix")}
        </option>
      </select>
      <small>
        {value === "INHERIT"
          ? t(
              "Keep the existing fee behavior for the selected payment method.",
              "Conserver le comportement actuel des frais pour le moyen de paiement choisi.",
            )
          : value === "INCLUSIVE"
            ? t(
                "The buyer pays the listed price. Payment fees are deducted from your proceeds.",
                "L’acheteur paie le prix affiché. Les frais de paiement sont déduits de vos recettes.",
              )
            : t(
                "The buyer pays the product price plus payment fees.",
                "L’acheteur paie le prix du produit et les frais de paiement.",
              )}
      </small>
    </label>
  );
}
