"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { request } from "./data";
import { publicApiCatalogRoute } from "./api-catalog";
import {
  ApiCatalogReader,
  catalogReadKey,
  refreshCatalogOnReturn,
  type CatalogReadScope,
} from "./api-catalog-reader";

async function readCatalog(path: string, init: RequestInit) {
  if (!path.startsWith(`${publicApiCatalogRoute}?`)) return request(path, init);
  const response = await fetch(path, { ...init, credentials: "omit" });
  if (!response.ok) {
    const french = new Headers(init.headers).get("Accept-Language") === "fr";
    throw new Error(
      french ? "Impossible de charger les moyens de paiement." : "Couldn’t load payment methods.",
    );
  }
  return response.json();
}

export function useApiCatalog(
  accountKey: string | null,
  businessId: number | undefined,
  currency: string,
  language: "en" | "fr",
  audience?: "public",
) {
  const [reader] = useState(() => new ApiCatalogReader(readCatalog));
  const state = useSyncExternalStore(reader.subscribe, reader.snapshot, reader.snapshot);
  const scope = useMemo<CatalogReadScope | undefined>(() => {
    if (audience === "public") return { audience, currency, language };
    if (accountKey && businessId) return { accountKey, businessId, currency, language };
  }, [accountKey, businessId, currency, language, audience]);
  const key = scope ? catalogReadKey(scope) : "";
  useEffect(() => {
    if (scope) void reader.load(scope);
    return reader.clear;
  }, [reader, scope]);
  useEffect(() => refreshCatalogOnReturn(document, () => void reader.refresh()), [reader]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: !!key && (state.key !== key || state.loading),
    refresh: reader.refresh,
  };
}
