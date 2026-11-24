"use client";

import { useEffect, useState } from "react";
import { request } from "./data";
import {
  billCatalogPath,
  parseBillCatalog,
  type BillCatalog,
  type BillCatalogQuery,
} from "./api-bill-catalog";
import { refreshCatalogOnReturn } from "./api-catalog-reader";

export function useApiBillCatalog(
  query: BillCatalogQuery,
  language: "en" | "fr",
  publicGuide: boolean,
  accountKey: string | null,
  businessId?: number,
) {
  const [revision, setRevision] = useState(0);
  const path = publicGuide
    ? billCatalogPath(query)
    : accountKey && businessId
      ? billCatalogPath(query, businessId)
      : "";
  const key = JSON.stringify([publicGuide ? null : accountKey, path, language, revision]);
  const [state, setState] = useState<{ key: string; data?: BillCatalog; error?: string }>({
    key: "",
  });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 18000);
    async function load() {
      try {
        const init = {
          signal: controller.signal,
          cache: "no-store" as const,
          headers: { "Accept-Language": language },
        };
        let value: unknown;
        if (publicGuide) {
          const response = await fetch(path, { ...init, credentials: "omit" });
          if (!response.ok)
            throw new Error(
              language === "fr"
                ? "Impossible de charger les produits de facturation."
                : "Couldn’t load bill products.",
            );
          value = await response.json();
        } else value = await request(path, init);
        const data = parseBillCatalog(value, query, publicGuide);
        if (active) setState({ key, data });
      } catch (error) {
        if (active)
          setState({
            key,
            error:
              error instanceof Error && error.name !== "AbortError"
                ? error.message
                : language === "fr"
                  ? "Le chargement a expiré. Réessayez."
                  : "Loading timed out. Please retry.",
          });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [key, path, language, query, publicGuide]);
  useEffect(() => refreshCatalogOnReturn(document, () => setRevision((value) => value + 1)), []);
  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: !!path && state.key !== key,
    refresh: () => setRevision((value) => value + 1),
  };
}
