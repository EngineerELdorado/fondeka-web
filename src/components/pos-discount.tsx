"use client";
import { useI18n } from "@/lib/i18n";
import type { PosDiscount } from "@/lib/pos-management";

export type DiscountDraft = {
  enabled: boolean;
  type: PosDiscount["type"];
  value: string;
  reason: string;
};
export const emptyDiscount: DiscountDraft = {
  enabled: false,
  type: "PERCENTAGE",
  value: "",
  reason: "",
};
export function DiscountFields({
  value,
  onChange,
  currency,
  available,
  disabled = false,
}: {
  value: DiscountDraft;
  onChange: (value: DiscountDraft) => void;
  currency: string;
  available: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="pos-discount form-stack" disabled={disabled || !available}>
      <legend>{t("Customer discount", "Remise client")}</legend>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        {t("Offer a discount", "Accorder une remise")}
      </label>
      {!available && (
        <p className="muted small">
          {t(
            "Discounts are not available for this store yet.",
            "Les remises ne sont pas encore disponibles pour cette boutique.",
          )}
        </p>
      )}
      {value.enabled && (
        <>
          <div className="form-grid">
            <label>
              {t("Discount type", "Type de remise")}
              <select
                value={value.type}
                onChange={(e) =>
                  onChange({ ...value, type: e.target.value as PosDiscount["type"] })
                }
              >
                <option value="PERCENTAGE">{t("Percentage (%)", "Pourcentage (%)")}</option>
                <option value="FIXED">
                  {t("Fixed amount", "Montant fixe")} ({currency})
                </option>
              </select>
            </label>
            <label>
              {t("Discount value", "Valeur de la remise")} (
              {value.type === "PERCENTAGE" ? "%" : currency})
              <input
                inputMode="decimal"
                value={value.value}
                onChange={(e) => onChange({ ...value, value: e.target.value })}
                required
              />
            </label>
          </div>
          <label>
            {t("Discount reason", "Motif de la remise")}
            <input
              value={value.reason}
              maxLength={500}
              onChange={(e) => onChange({ ...value, reason: e.target.value })}
              placeholder={t(
                "For example: customer negotiation",
                "Par exemple : négociation client",
              )}
              required
            />
          </label>
          <p className="muted small">
            {t(
              "The original price, discount and final total stay on the sale and its reports.",
              "Le prix initial, la remise et le total final restent associés à la vente et aux rapports.",
            )}
          </p>
        </>
      )}
    </fieldset>
  );
}
