"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./data";
import { useWorkspace } from "@/components/workspace-provider";
import { usePaymentLanguage } from "./use-payment-language";

/** Private course data lives only in the mounted account view, never the shared cache. */
export function useTrainingQuery<T>(path: string | null, revalidateOnFocus = true) {
  const { accountKey } = useWorkspace();
  const language = usePaymentLanguage();
  const identity = `${accountKey}:${language}:${path}`;
  const [result, setResult] = useState<{ identity: string; data?: T; error?: string }>({
    identity: "",
  });
  const task = useRef<() => Promise<T | undefined>>(async () => undefined);
  const refetch = useCallback(() => task.current(), []);
  useEffect(() => {
    if (!path || !accountKey) return;
    let active = true;
    let controller: AbortController | undefined;
    let pending: Promise<T | undefined> | undefined;
    const load = () => {
      if (pending) return pending;
      controller = new AbortController();
      pending = request<T>(path, {
        signal: controller.signal,
        headers: { "Accept-Language": language },
      })
        .then(
          (data) => {
            if (active) setResult({ identity, data });
            return active ? data : undefined;
          },
          (failure) => {
            if (active && failure?.name !== "AbortError")
              setResult({
                identity,
                error: failure instanceof Error ? failure.message : "Unable to load training.",
              });
            return undefined;
          },
        )
        .finally(() => {
          pending = undefined;
        });
      return pending;
    };
    task.current = load;
    void load();
    const resume = () => {
      if (document.visibilityState === "visible") void load();
    };
    if (revalidateOnFocus) {
      window.addEventListener("focus", resume);
      document.addEventListener("visibilitychange", resume);
    }
    return () => {
      active = false;
      controller?.abort();
      task.current = async () => undefined;
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [path, accountKey, identity, language, revalidateOnFocus]);
  return {
    data: result.identity === identity ? result.data : undefined,
    error: result.identity === identity ? result.error : undefined,
    loading: !!path && (result.identity !== identity || (!result.data && !result.error)),
    refetch,
  };
}
