"use client";
import { useState, type CSSProperties } from "react";
import { countryFlag } from "@/lib/payment-country";
import { safeLink } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { CurrencyPresentation } from "@/lib/currency-choices";

const currencyRegions: Record<string, string> = {
  USD: "US",
  CDF: "CD",
  EUR: "EU",
  GBP: "GB",
  KES: "KE",
  RWF: "RW",
  BIF: "BI",
  ETB: "ET",
  UGX: "UG",
  GHS: "GH",
  NGN: "NG",
  ZAR: "ZA",
  CAD: "CA",
  AUD: "AU",
  JPY: "JP",
  CHF: "CH",
  CNY: "CN",
};

export function CurrencyBadge({ currency }: { currency: string }) {
  const code = currency.trim().toUpperCase();
  const hues: Record<string, number> = { USD: 150, CDF: 270, EUR: 215 };
  const hue =
    hues[code] ??
    [...code].reduce((value, character) => value * 31 + character.charCodeAt(0), 0) % 360;
  return (
    <span
      className="currency-badge"
      data-currency={code}
      style={{ "--currency-hue": hue } as CSSProperties}
    >
      {code}
    </span>
  );
}

export function CurrencyIdentity({
  currency,
  metadata,
}: {
  currency: string;
  metadata?: CurrencyPresentation;
}) {
  const { language } = useI18n();
  let name = metadata?.displayName || currency;
  if (!metadata?.displayName) {
    try {
      name = new Intl.DisplayNames([language], { type: "currency" }).of(currency) || currency;
    } catch {
      /* The currency code remains unambiguous. */
    }
  }
  return (
    <span className="currency-identity">
      <CurrencyFlag currency={currency} metadata={metadata} />
      <span>
        <strong>{currency}</strong>
        <small>{name}</small>
      </span>
    </span>
  );
}

export function CurrencyFlag({
  currency,
  metadata,
}: {
  currency: string;
  metadata?: CurrencyPresentation;
}) {
  const region = currencyRegions[currency] || metadata?.countryCode;
  const source = safeLink(metadata?.logoUrl);
  return (
    <span className={`currency-flag ${region ? "" : "currency-flag-code"}`} aria-hidden="true">
      <FlagImage key={source} source={source} fallback={region ? countryFlag(region) : currency} />
    </span>
  );
}

function FlagImage({ source, fallback }: { source?: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  return source && !failed ? (
    <img
      src={source}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span>{fallback}</span>
  );
}
