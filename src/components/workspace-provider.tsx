"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { accessToken, authConfigured, customerScope, demoMode } from "@/lib/auth";
import { clearBusinessToolsRecovery } from "@/lib/business-tools-client";
import { clearSandboxFundingRecovery } from "@/lib/sandbox-funding";
import { clearSandboxConversionRecovery } from "@/lib/sandbox-conversion";
import { deviceHeaders, resetDeviceIdentityMemory } from "@/lib/device";
import { DeviceVerification } from "./device-verification";
import { clearQueryCache, clearCollectionRecovery } from "@/lib/query-cache";
import { clearFlowDrafts } from "@/lib/guided-flow";
import type { ApiEnvironment } from "@/lib/types";

const WorkspaceContext = createContext({
  version: 0,
  accountKey: null as string | null,
  apiEnvironment: "LIVE" as ApiEnvironment,
  selectApiEnvironment: (_environment: ApiEnvironment) => {},
  refresh: () => {},
  notify: (_message: string) => {},
  logout: async () => {},
});
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(demoMode);
  const [deviceRequired, setDeviceRequired] = useState(false);
  const [accountKey, setAccountKey] = useState<string | null>(demoMode ? "demo" : null);
  // Keep mode outside owner-data gates: a resume check must not turn a sandbox session into LIVE.
  const [apiScope, setApiScope] = useState<{ accountKey: string; environment: ApiEnvironment }>();
  const apiEnvironment = apiScope?.accountKey === accountKey ? apiScope.environment : "LIVE";
  const selectApiEnvironment = (environment: ApiEnvironment) => {
    if (accountKey) setApiScope({ accountKey, environment });
  };
  const [authRevision, setAuthRevision] = useState(0);
  const scopeRef = useRef(accountKey);
  const router = useRouter();
  const pathname = usePathname();
  const needsSession = pathname !== "/login";
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (demoMode) return;
    const reset = () => {
      clearQueryCache();
      clearCollectionRecovery();
      clearFlowDrafts();
      clearBusinessToolsRecovery();
      clearSandboxFundingRecovery();
      clearSandboxConversionRecovery();
      setApiScope(undefined);
      setAccountKey(null);
      scopeRef.current = null;
      setReady(false);
      setDeviceRequired(false);
      setToast("");
      setAuthRevision((value) => value + 1);
    };
    const stop = Hub.listen("auth", ({ payload }) => {
      if (
        payload.event === "signedIn" ||
        payload.event === "signedOut" ||
        payload.event === "tokenRefresh_failure"
      )
        reset();
    });
    const changed = (event: Event) => {
      const previous = (event as CustomEvent<{ previousAccountKey?: string }>).detail
        ?.previousAccountKey;
      if (previous && previous === scopeRef.current) reset();
    };
    window.addEventListener("fondeka:account-changed", changed);
    return () => {
      stop();
      window.removeEventListener("fondeka:account-changed", changed);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (demoMode || !needsSession) return;
    let active = true;
    async function check() {
      if (!authConfigured) {
        router.replace("/login");
        return;
      }
      try {
        const token = await accessToken();
        if (!token) router.replace("/login");
        else if (active) {
          const scope = await customerScope();
          if (!active) return;
          clearCollectionRecovery(scope);
          clearFlowDrafts(scope);
          clearBusinessToolsRecovery(undefined, scope);
          clearSandboxFundingRecovery(undefined, scope);
          clearSandboxConversionRecovery(undefined, scope);
          if (scopeRef.current !== scope) setApiScope(undefined);
          setAccountKey(scope);
          scopeRef.current = scope;
          setReady(true);
          if (!deviceHeaders()["X-Device-Session"]) setDeviceRequired(true);
        }
      } catch {
        router.replace("/login");
      }
    }
    void check();
    const expire = () => {
      setApiScope(undefined);
      setReady(false);
      setAccountKey(null);
      scopeRef.current = null;
      clearQueryCache();
      clearCollectionRecovery();
      clearFlowDrafts();
      clearBusinessToolsRecovery();
      clearSandboxFundingRecovery();
      clearSandboxConversionRecovery();
      router.replace("/login");
    };
    window.addEventListener("fondeka:session-expired", expire);
    const verifyDevice = () => setDeviceRequired(true);
    window.addEventListener("fondeka:device-required", verifyDevice);
    return () => {
      active = false;
      window.removeEventListener("fondeka:session-expired", expire);
      window.removeEventListener("fondeka:device-required", verifyDevice);
    };
  }, [needsSession, router, authRevision]);
  const logout = useCallback(async () => {
    setApiScope(undefined);
    clearQueryCache();
    clearCollectionRecovery();
    clearFlowDrafts();
    clearBusinessToolsRecovery();
    clearSandboxFundingRecovery();
    clearSandboxConversionRecovery();
    setAccountKey(demoMode ? "demo" : null);
    scopeRef.current = demoMode ? "demo" : null;
    try {
      if (!demoMode) await signOut();
    } finally {
      resetDeviceIdentityMemory();
      setReady(demoMode);
      setDeviceRequired(false);
      setVersion((value) => value + 1);
      router.replace("/login");
    }
  }, [router]);
  return (
    <WorkspaceContext.Provider
      value={{ version, accountKey, apiEnvironment, selectApiEnvironment, refresh, notify, logout }}
    >
      {pathname === "/login" ? (
        children
      ) : deviceRequired ? (
        <DeviceVerification
          onVerified={() => {
            setDeviceRequired(false);
            refresh();
          }}
          onLogout={() => void logout()}
        />
      ) : ready && accountKey ? (
        <div key={accountKey} className="workspace-session">
          {children}
        </div>
      ) : (
        <div className="full-loading">
          <span className="spinner" /> Opening your workspace…
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="status-dot" />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}
export const useWorkspace = () => useContext(WorkspaceContext);
