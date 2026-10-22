"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "aws-amplify/auth";
import { accessToken, authConfigured, demoMode } from "@/lib/auth";
import { deviceHeaders, resetDeviceIdentityMemory } from "@/lib/device";
import { DeviceVerification } from "./device-verification";

const WorkspaceContext = createContext({
  version: 0,
  refresh: () => {},
  notify: (_message: string) => {},
  logout: async () => {},
});
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(demoMode);
  const [deviceRequired, setDeviceRequired] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (demoMode || pathname === "/login") return;
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
          setReady(true);
          if (!deviceHeaders()["X-Device-Session"]) setDeviceRequired(true);
        }
      } catch {
        router.replace("/login");
      }
    }
    void check();
    const expire = () => {
      setReady(false);
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
  }, [pathname, router]);
  const logout = useCallback(async () => {
    if (!demoMode) await signOut();
    resetDeviceIdentityMemory();
    setReady(demoMode);
    setDeviceRequired(false);
    setVersion((value) => value + 1);
    router.replace("/login");
  }, [router]);
  return (
    <WorkspaceContext.Provider value={{ version, refresh, notify, logout }}>
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
      ) : ready ? (
        children
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
