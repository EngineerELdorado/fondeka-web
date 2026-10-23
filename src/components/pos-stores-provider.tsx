"use client";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { OwnerQueriesEnabled } from "@/lib/owner-query-context";
import { PosStoresClient } from "@/lib/pos-stores";
import { usePaymentLanguage } from "@/lib/use-payment-language";

const Context = createContext<PosStoresClient | null>(null);
export function PosStoresProvider({
  client,
  children,
}: {
  client: PosStoresClient;
  children: ReactNode;
}) {
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
export function usePosStoresPage(page = 0) {
  const client = useContext(Context);
  if (!client) throw new Error("POS needs an authenticated workspace.");
  const language = usePaymentLanguage();
  const enabled = useContext(OwnerQueriesEnabled);
  const revision = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const state = client.page(page, language);
  useEffect(() => {
    if (enabled && !client.fresh(page, language) && !state.loading && !state.error)
      void client.load(page, language).catch(() => {});
  }, [client, enabled, language, page, revision, state.loading, state.error]);
  return {
    ...state,
    loading: (!state.data && !state.error) || state.loading,
    refresh: () => {
      client.invalidate();
      if (enabled) void client.load(page, language).catch(() => {});
    },
  };
}
