"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { request } from "./data";
import { ApiCatalogReader, catalogReadKey, refreshCatalogOnReturn } from "./api-catalog-reader";

export function useApiCatalog(
  accountKey: string | null,
  businessId: number | undefined,
  currency: string,
  language: "en" | "fr",
) {
  const [reader] = useState(() => new ApiCatalogReader(request));
  const state = useSyncExternalStore(reader.subscribe, reader.snapshot, reader.snapshot);
  const key =
    accountKey && businessId ? catalogReadKey({ accountKey, businessId, currency, language }) : "";
  useEffect(() => {
    if (accountKey && businessId) void reader.load({ accountKey, businessId, currency, language });
    return reader.clear;
  }, [reader, accountKey, businessId, currency, language]);
  useEffect(() => refreshCatalogOnReturn(document, () => void reader.refresh()), [reader]);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: !!key && (state.key !== key || state.loading),
    refresh: reader.refresh,
  };
}
