"use client";
import { useState } from "react";
import { Bitcoin, Landmark, Smartphone } from "lucide-react";
import type { PaymentMethod } from "@/lib/business-tools";
import { safeLink } from "@/lib/format";
import { CurrencyFlag } from "./currency-identity";

export function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  const source = typeof method.logoUrl === "string" ? safeLink(method.logoUrl) : undefined;
  if (method.type === "BALANCE")
    return <CurrencyFlag currency={method.currency || ""} metadata={{ logoUrl: source }} />;
  return <MethodLogo key={source} method={method} source={source} />;
}
function MethodLogo({ method, source }: { method: PaymentMethod; source?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`payment-provider-logo ${source && !failed ? "has-logo" : ""}`}
      aria-hidden="true"
    >
      {source && !failed ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : method.type === "CRYPTO" ? (
        /^(BTC|BITCOIN)$/i.test(method.name) ? (
          <Bitcoin size={25} />
        ) : (
          <span className="payment-crypto-symbol">
            {method.name.trim().slice(0, 4).toUpperCase()}
          </span>
        )
      ) : method.type === "MOBILE_MONEY" ? (
        <Smartphone size={25} />
      ) : (
        <Landmark size={25} />
      )}
    </span>
  );
}
