"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { request } from "@/lib/data";
import {
  businessDestination,
  isBusinessTool,
  hasToolAccess,
  type BusinessTool,
} from "@/lib/business-tools";
import { useUrlState } from "@/lib/use-url-state";
import { BusinessToolsClient, mayMountOwnerData } from "@/lib/business-tools-client";
import { mayContinueToTool, paymentCopy } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
import { OwnerQueriesEnabled } from "@/lib/owner-query-context";
import { PosStoresClient, resolvePosDestination, validStoreId } from "@/lib/pos-stores";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@/lib/use-query";
import { forgetCommerceQueries } from "@/lib/query-cache";
import type { Store } from "@/lib/types";
import { isStoreOwner } from "@/lib/commerce";
import { storeWorkspaceId, storeVisible } from "@/lib/shared-stores";
import { PosStoresProvider } from "./pos-stores-provider";
import { useWorkspace } from "./workspace-provider";
import { Loading, Modal, ErrorState } from "./ui";
import {
  ActiveAccessPaymentNotice,
  BusinessToolsScreen,
  LockedToolPreview,
} from "./business-tools-screen";

const proactiveGate = process.env.NEXT_PUBLIC_BUSINESS_TOOLS_ENABLED === "true";
const Context = createContext<BusinessToolsClient | null>(null);
const Navigation = createContext({
  enabled: false,
  open: (_destination: string, _denied = false, _tool?: BusinessTool) => {},
  enter: (_destination: string) => {},
});
export function useToolNavigation() {
  return useContext(Navigation);
}
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
  const [scope, setScope] = useState<{
    client: BusinessToolsClient;
    stores: PosStoresClient;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const scoped = new BusinessToolsClient({
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
      onGranted: () => {
        if (active) refresh();
      },
    });
    const stores = new PosStoresClient(request);
    setScope({ client: scoped, stores });
    const resumePayment = () => {
      if (scoped.getSnapshot().purchase?.status === "PENDING") return scoped.checkStatus();
    };
    // Let the mount settle so development Strict Mode’s discarded scope makes no request.
    const initialCheck = window.setTimeout(() => void scoped.ensureAccess().then(resumePayment), 0);
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      void scoped.revalidate().then(resumePayment);
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      if (initialCheck !== undefined) window.clearTimeout(initialCheck);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
      scoped.dispose();
      stores.dispose();
    };
  }, [accountKey, refresh]);
  return scope ? (
    <PosStoresProvider client={scope.stores}>
      <Experience client={scope.client} stores={scope.stores} accountKey={accountKey}>
        {children}
      </Experience>
    </PosStoresProvider>
  ) : (
    <Loading rows={3} />
  );
}
function Experience({
  client,
  stores,
  accountKey,
  children,
}: {
  client: BusinessToolsClient;
  stores: PosStoresClient;
  accountKey: string;
  children: ReactNode;
}) {
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [dialog, setDialog] = useState<{ destination: string; returnTo: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const language = usePaymentLanguage();
  const { t } = useI18n();
  const enabled = proactiveGate || state.forced;
  const handoff = useRef<string | undefined>(undefined);
  const navigation = useRef(0);
  const resolvingPos = useRef(false);
  const [posResolution, setPosResolution] = useState<{ error?: string }>();
  useEffect(
    () => () => {
      navigation.current++;
    },
    [pathname],
  );
  useEffect(() => {
    const cancel = () => {
      navigation.current++;
      resolvingPos.current = false;
      setPosResolution(undefined);
    };
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, []);
  const navigate = useCallback(
    async (destination: string) => {
      const intent = ++navigation.current;
      resolvingPos.current = false;
      const url = new URL(destination, "https://portal.invalid");
      const legacyStore = Number(url.searchParams.get("store"));
      if (url.pathname === "/pos" && validStoreId(legacyStore))
        destination = `/stores/${legacyStore}/pos`;
      if (destination.split("?")[0] !== "/pos") {
        setPosResolution(undefined);
        handoff.current = destination;
        if (window.location.pathname + window.location.search !== destination)
          router.push(destination);
        return;
      }
      resolvingPos.current = true;
      setPosResolution({});
      try {
        await client.ensureAccess();
        if (intent !== navigation.current) return;
        if (!hasToolAccess(client.getSnapshot().accountAccess, "POS")) {
          resolvingPos.current = false;
          setPosResolution(undefined);
          router.push("/stores?mode=pos&view=shared");
          return;
        }
        const target = await resolvePosDestination(stores, language, async () => {
          if (intent !== navigation.current) return false;
          if (!enabled) return true;
          await client.ensureAccess();
          return (
            intent === navigation.current && mayMountOwnerData(client.getSnapshot(), "/pos", true)
          );
        });
        if (intent !== navigation.current) return;
        if (!target) {
          setPosResolution(undefined);
          resolvingPos.current = false;
          setDialog({ destination: "/pos", returnTo: "/overview" });
          return;
        }
        handoff.current = target;
        resolvingPos.current = false;
        setPosResolution(undefined);
        if (window.location.pathname + window.location.search !== target) router.push(target);
      } catch (error) {
        if (intent !== navigation.current) return;
        if (error instanceof Error && error.name === "AbortError") {
          // A store mutation invalidated the in-flight count; resolve again using the new list.
          void navigate(destination);
          return;
        }
        resolvingPos.current = false;
        setPosResolution({
          error:
            error instanceof Error
              ? error.message
              : "Unable to load your stores. Please try again.",
        });
      }
    },
    [client, enabled, language, router, stores],
  );
  // Warm the POS decision only after access is known. Failed preloads remain retryable on click.
  useEffect(() => {
    if (
      !["/overview", "/business"].includes(pathname) ||
      !hasToolAccess(state.accountAccess, "POS") ||
      !mayMountOwnerData(state, "/pos", enabled)
    )
      return;
    void stores.load(0, language).catch(() => {});
  }, [enabled, language, pathname, state, stores]);
  const open = useCallback(
    (destination: string, denied = false, tool?: BusinessTool) => {
      const known = businessDestination(destination);
      if (!known) return;
      const hadAccess = mayMountOwnerData(client.getSnapshot(), known, enabled);
      navigation.current++;
      resolvingPos.current = false;
      setPosResolution(undefined);
      handoff.current = undefined;
      const target = new URL(known, "https://portal.invalid");
      if (
        !denied &&
        !tool &&
        (target.pathname === "/pos" ||
          (target.pathname === "/stores" &&
            !target.searchParams.has("new") &&
            target.searchParams.get("view") !== "owned"))
      ) {
        setDialog(undefined);
        void navigate(known);
        return;
      }
      if (!enabled && !denied) {
        void navigate(known);
        return;
      }
      void client.enter(known, denied, tool);
      if (!denied && mayContinueToTool(client.getSnapshot(), known)) {
        setDialog(undefined);
        void navigate(known);
        return;
      }
      const current = window.location.pathname;
      setDialog({
        destination: known,
        returnTo: hadAccess
          ? businessDestination(window.location.pathname + window.location.search) || "/overview"
          : current === "/settings"
            ? "/settings"
            : current === "/business"
              ? "/business"
              : "/overview",
      });
    },
    [client, enabled, navigate],
  );
  useEffect(() => {
    const denied = (event: Event) => {
      const detail = (event as CustomEvent<{ accountKey: string; tool?: BusinessTool }>).detail;
      if (detail?.accountKey !== accountKey) return;
      const destination = resolvingPos.current
        ? "/pos"
        : businessDestination(window.location.pathname + window.location.search);
      if (destination)
        open(destination, true, isBusinessTool(detail.tool) ? detail.tool : undefined);
    };
    window.addEventListener("fondeka:business-tools-required", denied);
    return () => window.removeEventListener("fondeka:business-tools-required", denied);
  }, [accountKey, open]);
  useEffect(() => {
    if (!dialog || !mayContinueToTool(state, dialog.destination)) return;
    setDialog(undefined);
    void navigate(dialog.destination);
  }, [state, dialog, navigate]);
  const previousLanguage = useRef(language);
  useEffect(() => {
    // A selected locale also determines backend plan/error localization.
    if (previousLanguage.current === language) return;
    previousLanguage.current = language;
    if (client.getSnapshot().accountAccess || proactiveGate || client.getSnapshot().forced)
      void client.reload(false, { background: true });
  }, [client, language]);
  const enter = useCallback(
    (destination: string) => {
      if (handoff.current === destination) {
        handoff.current = undefined;
        return;
      }
      open(destination);
    },
    [open],
  );
  const close = () => {
    if (state.busy) return;
    setDialog(undefined);
    client.dismissOffer();
    if (dialog && window.location.pathname + window.location.search !== dialog.returnTo)
      router.push(dialog.returnTo);
  };
  return (
    <Context.Provider value={client}>
      <Navigation.Provider value={{ enabled, open, enter }}>
        {children}
        {dialog && <BusinessToolsScreen onClose={close} />}
        {posResolution && !dialog && (
          <Modal
            title={t("Opening POS", "Ouverture du POS")}
            onClose={() => {
              navigation.current++;
              resolvingPos.current = false;
              setPosResolution(undefined);
              if (pathname === "/pos") router.replace("/overview");
            }}
          >
            {posResolution.error ? (
              <ErrorState
                message={
                  posResolution.error === "Unable to load your stores. Please try again."
                    ? t(
                        "Unable to load your stores. Please try again.",
                        "Impossible de charger vos boutiques. Veuillez réessayer.",
                      )
                    : posResolution.error
                }
                retry={() => void navigate("/pos")}
              />
            ) : (
              <Loading rows={2} />
            )}
          </Modal>
        )}
      </Navigation.Provider>
    </Context.Provider>
  );
}
export function OwnerArea({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { values } = useUrlState();
  const storeId = storeWorkspaceId(pathname);
  if (storeId)
    return (
      <StoreWorkspaceGate
        key={`${storeId}:${pathname}`}
        id={storeId}
        destination={`${pathname}?${values}`}
      >
        {children}
      </StoreWorkspaceGate>
    );
  if (["/stores", "/pos"].includes(pathname)) return children;
  if (["/overview", "/business", "/settings"].includes(pathname) || !businessDestination(pathname))
    return children;
  return (
    <BusinessToolsGate
      key={pathname}
      destination={businessDestination(`${pathname}?${values}`) || pathname}
    >
      {children}
    </BusinessToolsGate>
  );
}
export function BusinessToolsGate({
  children,
  destination,
  passive = false,
}: {
  children: ReactNode;
  destination: string;
  passive?: boolean;
}) {
  const { client, state } = useBusinessTools();
  const { enabled, open, enter } = useToolNavigation();
  const wasGranted = useRef(false);
  const language = usePaymentLanguage();
  const copy = paymentCopy(language);
  useEffect(() => {
    if (!enabled || passive) return;
    if (["/overview", "/business"].includes(destination)) void client.enter(destination);
    else
      enter(businessDestination(window.location.pathname + window.location.search) || destination);
  }, [client, destination, enabled, enter, passive]);
  useEffect(() => {
    if (!enabled || passive || ["/overview", "/business"].includes(destination) || state.loading)
      return;
    if (mayMountOwnerData(state, destination, true)) {
      wasGranted.current = true;
    } else if (wasGranted.current) {
      wasGranted.current = false;
      open(destination);
    }
  }, [destination, enabled, open, state, passive]);
  const allowed = mayMountOwnerData(
    state,
    destination,
    enabled || passive || ["/overview", "/business"].includes(destination),
  );
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (allowed) setOpened(true);
  }, [allowed]);
  // Keep unsent form/cart state in memory while activation is open. The subtree is
  // hidden, inert and unable to start queries until access is granted again.
  const retain = allowed || opened;
  if (retain)
    return (
      <OwnerQueriesEnabled.Provider value={allowed}>
        <div className="owner-data" hidden={!allowed} inert={!allowed}>
          <ActiveAccessPaymentNotice />
          {children}
        </div>
        {!allowed && (
          <LockedToolPreview
            destination={destination}
            checking
            label={copy.checking}
            onOpen={() => open(destination)}
          />
        )}
      </OwnerQueriesEnabled.Provider>
    );

  return (
    <LockedToolPreview
      destination={destination}
      checking={state.loading}
      error={!!state.error}
      label={state.error ? copy.errorTitle : copy.lockedHint}
      onOpen={() => open(destination)}
    />
  );
}

/** Membership reads may run before personal billing; only the actual store role opens staff data. */
function StoreWorkspaceGate({
  id,
  destination,
  children,
}: {
  id: string;
  destination: string;
  children: ReactNode;
}) {
  const store = useQuery<Store>(`/customer-api/commerce/stores/${id}`);
  const { accountKey } = useWorkspace();
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);
  const [denial, setDenial] = useState<string>();
  const { refetch } = store;
  const capabilityKey = JSON.stringify([
    store.data?.accessType,
    store.data?.capabilities,
    store.data?.staffPermissions,
  ]);
  const previousCapabilities = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!store.data) return;
    const previous = previousCapabilities.current;
    previousCapabilities.current = capabilityKey;
    if (previous !== undefined && previous !== capabilityKey && accountKey)
      forgetCommerceQueries(accountKey, `/customer-api/commerce/stores/${id}`);
  }, [accountKey, capabilityKey, id, store.data]);
  useEffect(() => {
    let active = true;
    let running = false;
    const check = () => {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      void refetch().finally(() => {
        running = false;
        if (active) setChecked(true);
      });
    };
    const changed = (event: Event) => {
      const detail = (
        event as CustomEvent<{ accountKey?: string; storeId?: number; message?: string }>
      ).detail;
      if (detail?.accountKey !== accountKey || (detail.storeId && String(detail.storeId) !== id))
        return;
      // A readable membership does not mean the denied operation or owner's plan is available.
      // Keep children unmounted until the customer explicitly retries; never replay the action.
      setDenial(
        detail.message || t("Store access unavailable.", "Accès à la boutique indisponible."),
      );
      setChecked(false);
      check();
    };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("fondeka:store-access-changed", changed);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("fondeka:store-access-changed", changed);
    };
  }, [accountKey, id, refetch, t]);
  const error = denial || store.error || store.refreshError;
  if (error)
    return (
      <ErrorState
        message={error}
        retry={() => {
          setDenial(undefined);
          setChecked(false);
          void refetch().finally(() => setChecked(true));
        }}
      />
    );
  if (!checked || store.loading) return <Loading rows={3} />;
  if (!store.data || !storeVisible(store.data))
    return (
      <ErrorState
        message={t(
          "This store is no longer available to your account.",
          "Cette boutique n’est plus accessible avec votre compte.",
        )}
        retry={() => void refetch()}
      />
    );
  if (isStoreOwner(store.data))
    return <BusinessToolsGate destination={destination}>{children}</BusinessToolsGate>;
  return (
    <OwnerQueriesEnabled.Provider value={true}>
      <div key={JSON.stringify(store.data.capabilities || store.data.staffPermissions)}>
        {children}
      </div>
    </OwnerQueriesEnabled.Provider>
  );
}
