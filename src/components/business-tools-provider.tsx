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
import { businessDestination } from "@/lib/business-tools";
import { BusinessToolsClient, mayMountOwnerData } from "@/lib/business-tools-client";
import { mayContinueToTool, paymentCopy } from "@/lib/business-tools-ui";
import { usePaymentLanguage } from "@/lib/use-payment-language";
import { OwnerQueriesEnabled } from "@/lib/owner-query-context";
import { PosStoresClient, resolvePosDestination, validStoreId } from "@/lib/pos-stores";
import { useI18n } from "@/lib/i18n";
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
  open: (_destination: string, _denied = false) => {},
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
    // Let the mount settle so development Strict Mode’s discarded scope makes no request.
    const initialCheck = proactiveGate
      ? window.setTimeout(() => void scoped.ensureAccess(), 0)
      : undefined;
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      const state = scoped.getSnapshot();
      if (proactiveGate || state.forced) void scoped.reload();
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
      !mayMountOwnerData(state, "/pos", enabled)
    )
      return;
    void stores.load(0, language).catch(() => {});
  }, [enabled, language, pathname, state, stores]);
  const open = useCallback(
    (destination: string, denied = false) => {
      const known = businessDestination(destination);
      if (!known) return;
      navigation.current++;
      resolvingPos.current = false;
      setPosResolution(undefined);
      handoff.current = undefined;
      if (!enabled && !denied) {
        void navigate(known);
        return;
      }
      void client.enter(known, denied);
      if (!denied && mayContinueToTool(client.getSnapshot(), known)) {
        setDialog(undefined);
        void navigate(known);
        return;
      }
      const current = window.location.pathname;
      setDialog({
        destination: known,
        returnTo:
          current === "/settings"
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
      if ((event as CustomEvent<{ accountKey: string }>).detail?.accountKey !== accountKey) return;
      const destination = resolvingPos.current
        ? "/pos"
        : businessDestination(window.location.pathname + window.location.search);
      if (destination) open(destination, true);
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
    if (proactiveGate || client.getSnapshot().forced) void client.reload();
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
    if (dialog && pathname !== dialog.returnTo) router.push(dialog.returnTo);
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
  if (["/overview", "/business"].includes(pathname) || !businessDestination(pathname))
    return children;
  return (
    <BusinessToolsGate key={pathname} destination={pathname}>
      {children}
    </BusinessToolsGate>
  );
}
export function BusinessToolsGate({
  children,
  destination,
}: {
  children: ReactNode;
  destination: string;
}) {
  const { client, state } = useBusinessTools();
  const { enabled, open, enter } = useToolNavigation();
  const wasGranted = useRef(false);
  const language = usePaymentLanguage();
  const copy = paymentCopy(language);
  useEffect(() => {
    if (!enabled) return;
    if (["/overview", "/business"].includes(destination)) void client.enter(destination);
    else
      enter(businessDestination(window.location.pathname + window.location.search) || destination);
  }, [client, destination, enabled, enter]);
  useEffect(() => {
    if (!enabled || ["/overview", "/business"].includes(destination) || state.loading) return;
    if (mayMountOwnerData(state, destination, true)) {
      wasGranted.current = true;
    } else if (wasGranted.current) {
      wasGranted.current = false;
      open(destination);
    }
  }, [destination, enabled, open, state]);
  const allowed = mayMountOwnerData(state, destination, enabled);
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
