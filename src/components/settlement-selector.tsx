"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { normalizeMethods, methodKey, type PaymentMethod } from "@/lib/business-tools";
import type { PaymentRequest } from "@/lib/types";
export type SettlementValue = {
  paymentMethod: { id: number; accountRef: string; networkId?: number };
  currency: string;
};

export function SettlementFields({
  type,
  currency,
  onChange,
  existing,
  value,
  expanded = false,
}: {
  type: string;
  currency: string;
  onChange: (v: unknown) => void;
  existing?: PaymentRequest["settlement"];
  value?: SettlementValue | null;
  expanded?: boolean;
}) {
  const { t } = useI18n();
  const settings = useQuery<{ type: string; allowCustomSettlement: boolean }[]>(
    "/customer-api/payment_requests/type-settings",
  );
  const allowed = settings.data?.find((s) => s.type === type)?.allowCustomSettlement;
  const [enabled, setEnabled] = useState(!!value);
  const [key, setKey] = useState("");
  const [accountRef, setAccountRef] = useState(value?.paymentMethod.accountRef || "");
  const [network, setNetwork] = useState(
    value?.paymentMethod.networkId ? String(value.paymentMethod.networkId) : "",
  );
  const methods = useQuery<unknown>(
    enabled && allowed ? "/customer-api/payment_methods?type=PAYOUT&action=SETTLEMENT" : null,
    { "X-Client-Version": "1.0.97" },
  );
  let list: PaymentMethod[] = [];
  try {
    if (methods.data)
      list = normalizeMethods(methods.data).paymentMethods.filter((m) => m.type !== "BALANCE");
  } catch {
    /* Render the normal retry state. */
  }
  const restoredMethod = value ? list.find((m) => m.id === value.paymentMethod.id) : undefined;
  const currentKey = key || (restoredMethod ? methodKey(restoredMethod) : "");
  const selected = list.find((m) => methodKey(m) === currentKey);
  const networks = useQuery<{ id: number; name: string }[]>(
    selected?.type === "CRYPTO"
      ? `/customer-api/crypto-networks/payment-methods/${selected.id}/networks`
      : null,
  );
  function update(next: { key?: string; accountRef?: string; network?: string }) {
    const m = list.find((m) => methodKey(m) === (next.key ?? currentKey));
    if (m)
      onChange({
        paymentMethod: {
          id: m.id,
          accountRef: next.accountRef ?? accountRef,
          ...(m.type === "CRYPTO" ? { networkId: Number(next.network ?? network) } : {}),
        },
        currency: m.currency || currency,
      });
  }
  return (
    <details className="form-section" open={expanded}>
      <summary>{t("Settlement destination", "Destination du règlement")}</summary>
      {existing && (
        <p>
          {t("Current destination", "Destination actuelle")}:{" "}
          {existing.accountRef || t("Account balance", "Solde du compte")} ·{" "}
          {existing.currency || currency}
        </p>
      )}
      <label>
        <select
          value={enabled ? "external" : "balance"}
          onChange={(e) => {
            setEnabled(e.target.value === "external");
            if (e.target.value === "balance") onChange(null);
            else onChange({ paymentMethod: { id: 0, accountRef: "" }, currency });
          }}
        >
          <option value="balance">{t("Fondeka account balance", "Solde du compte Fondeka")}</option>
          {allowed && (
            <option value="external">{t("External destination", "Destination externe")}</option>
          )}
        </select>
      </label>
      {enabled && allowed && (
        <>
          <label>
            {t("Method", "Moyen")}
            <select
              required
              value={currentKey}
              onChange={(e) => {
                setKey(e.target.value);
                setNetwork("");
                update({ key: e.target.value, network: "" });
              }}
            >
              <option value="">{t("Select", "Choisir")}</option>
              {list.map((m) => (
                <option key={methodKey(m)} value={methodKey(m)}>
                  {m.name} · {m.currency}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Phone number or crypto address", "Numéro de téléphone ou adresse crypto")}
            <input
              required
              maxLength={254}
              value={accountRef}
              onChange={(e) => {
                setAccountRef(e.target.value);
                update({ accountRef: e.target.value });
              }}
            />
          </label>
          {selected?.type === "CRYPTO" && (
            <label>
              {t("Network", "Réseau")}
              <select
                required
                value={network}
                onChange={(e) => {
                  setNetwork(e.target.value);
                  update({ network: e.target.value });
                }}
              >
                <option value="">{t("Select", "Choisir")}</option>
                {networks.data?.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(methods.error || networks.error) && (
            <p role="alert">{methods.error || networks.error}</p>
          )}
        </>
      )}
    </details>
  );
}
