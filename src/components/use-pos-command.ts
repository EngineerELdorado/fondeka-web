"use client";
import { useMemo, useSyncExternalStore } from "react";
import { PosCommand } from "@/lib/pos-command";
import { request } from "@/lib/data";
import { useWorkspace } from "./workspace-provider";

export function usePosCommand(path: string) {
  const { accountKey } = useWorkspace();
  const client = useMemo(
    () =>
      new PosCommand({
        accountKey: accountKey || "unavailable",
        path,
        request,
        storage: {
          getItem: (key) =>
            typeof window === "undefined" ? null : window.sessionStorage.getItem(key),
          setItem: (key, value) => {
            if (!accountKey) throw new Error("Session required.");
            window.sessionStorage.setItem(key, value);
          },
          removeItem: (key) => window.sessionStorage.removeItem(key),
        },
      }),
    [accountKey, path],
  );
  return {
    ...useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot),
    submit: client.submit.bind(client),
    resetCompleted: client.resetCompleted.bind(client),
  };
}
