"use client";

import { useState } from "react";
import { Coins, Smartphone } from "lucide-react";
import { cryptoMethodLogo } from "@/lib/crypto-method-logo";
import type { ApiCatalogMethod } from "@/lib/api-catalog";
import { safeLink } from "@/lib/format";

export function CatalogCryptoLogo({ name }: { name: string }) {
  const source = cryptoMethodLogo(name);
  const [failed, setFailed] = useState<string>();
  return source && failed !== source ? (
    <img
      className="api-catalog-crypto-logo"
      src={source}
      width={32}
      height={32}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(source)}
    />
  ) : (
    <Coins className="api-catalog-crypto-logo" size={32} aria-hidden="true" />
  );
}

export function CatalogMethodLogo({ method }: { method: ApiCatalogMethod }) {
  const source = safeLink(method.logoUrl ?? undefined);
  const [failed, setFailed] = useState<string>();
  if (source && source !== failed)
    return (
      <img
        className="api-catalog-crypto-logo"
        src={source}
        width={32}
        height={32}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        onError={() => setFailed(source)}
      />
    );
  return method.type === "CRYPTO" ? (
    <CatalogCryptoLogo name={method.name} />
  ) : (
    <Smartphone className="api-catalog-crypto-logo" size={32} aria-hidden="true" />
  );
}
