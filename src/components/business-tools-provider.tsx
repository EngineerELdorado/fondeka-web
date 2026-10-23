"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { request } from "@/lib/data";
import { businessDestination } from "@/lib/business-tools";
import { BusinessToolsClient, mayMountOwnerData } from "@/lib/business-tools-client";
import { useWorkspace } from "./workspace-provider";
import { ErrorState, Loading } from "./ui";
import { ActiveAccessPaymentNotice, BusinessToolsScreen } from "./business-tools-screen";

const proactiveGate = process.env.NEXT_PUBLIC_BUSINESS_TOOLS_ENABLED === "true";
const Context = createContext<BusinessToolsClient | null>(null);
export function useBusinessTools() {
  const client = useContext(Context);
  if (!client) throw new Error("Business Tools needs an authenticated workspace.");
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  return { client, state };
}
export function BusinessToolsProvider({ children }: { children: ReactNode }) {
  const { accountKey, refresh } = useWorkspace();
  return accountKey ? (
    <ScopedProvider key={accountKey} accountKey={accountKey} refresh={refresh}>
      {children}
    </ScopedProvider>
  ) : null;
}
function ScopedProvider({
  accountKey,
  refresh,
  children,
}: {
  accountKey: string;
  refresh: () => void;
  children: ReactNode;
}) {
  const [client, setClient] = useState<BusinessToolsClient | null>(null);
  useEffect(() => {
    let active = true;
    const scopedClient = new BusinessToolsClient({
      accountKey,
      request: (path, init) =>
        request(path, {
          ...init,
          headers: { "Accept-Language": document.documentElement.lang || "en", ...init?.headers },
        }),
      storage: {
        getItem: (key) => sessionStorage.getItem(key),
        setItem: (key, value) => sessionStorage.setItem(key, value),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      // Wallet/method views are unmounted on activation; refresh invalidates all other account queries.
      onGranted: () => {
        if (active) refresh();
      },
    });
    setClient(scopedClient);
    const denied = (event: Event) => {
      if ((event as CustomEvent<{ accountKey: string }>).detail?.accountKey !== accountKey) return;
      const destination = businessDestination(window.location.pathname + window.location.search);
      if (destination) void scopedClient.enter(destination, true);
    };
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      const state = scopedClient.getSnapshot();
      if ((proactiveGate || state.forced) && state.destination) void scopedClient.reload();
    };
    window.addEventListener("fondeka:business-tools-required", denied);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.removeEventListener("fondeka:business-tools-required", denied);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
      scopedClient.dispose();
    };
  }, [accountKey, refresh]);
  return client ? (
    <Context.Provider value={client}>{children}</Context.Provider>
  ) : (
    <Loading rows={3} />
  );
}
export function OwnerArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/overview" || !businessDestination(pathname)) return children;
  return <BusinessToolsGate destination={pathname}>{children}</BusinessToolsGate>;
}
export function BusinessToolsGate({
  children,
  destination,
}: {
  children: ReactNode;
  destination: string;
}) {
  const { client, state } = useBusinessTools();
  const enabled = proactiveGate || state.forced;
  const [entered, setEntered] = useState<string>();
  useEffect(() => {
    if (enabled) {
      void client.enter(
        businessDestination(window.location.pathname + window.location.search) || destination,
      );
      setEntered(destination);
    }
  }, [client, destination, enabled]);
  // A remounted route must check access before its child effects can fetch owner data.
  if (enabled && entered !== destination) return <Loading rows={3} />;
  if (mayMountOwnerData(state, destination, enabled))
    return (
      <>
        <ActiveAccessPaymentNotice />
        {children}
      </>
    );
  if (!state.destination || state.destination.split("?")[0] !== destination || !state.access)
    return state.error ? (
      <ErrorState message={state.error} retry={() => void client.reload()} />
    ) : (
      <Loading rows={3} />
    );
  if (!state.access.accessGranted) return <BusinessToolsScreen />;
  if (state.loading) return <Loading rows={3} />;
  if (state.error) return <ErrorState message={state.error} retry={() => void client.reload()} />;
  if (state.resourceUnavailable)
    return (
      <ErrorState
        message="Your account has Business Tools access, but this resource is unavailable. The owner’s access or your permissions may need review. Contact Fondeka support if this continues."
        retry={() => void client.retryResource()}
      />
    );
  return <Loading rows={3} />;
}
