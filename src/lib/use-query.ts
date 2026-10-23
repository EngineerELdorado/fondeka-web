"use client";

import { useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { OwnerQueriesEnabled } from "./owner-query-context";
import { request } from "./data";
import {
  cacheQuery,
  cachedQuery,
  queryCacheGeneration,
  subscribeQueries,
  queryRevision,
} from "./query-cache";
import { usePaymentLanguage } from "./use-payment-language";

export function useQuery<T>(path: string | null, headers?: Record<string, string>, revision = 0) {
  const enabled = useContext(OwnerQueriesEnabled);
  const { version, accountKey } = useWorkspace();
  const [state, setState] = useState<{
    key: string;
    identity?: string;
    data?: T;
    error?: string;
    loading: boolean;
  }>({
    key: "",
    loading: true,
  });
  const language = usePaymentLanguage();
  const headerKey = JSON.stringify({ "Accept-Language": language, ...headers });
  const invalidation = useSyncExternalStore(
    subscribeQueries,
    () => queryRevision(path),
    () => "0:0",
  );
  const identity = `${accountKey}:${path}`;
  const key = `${identity}:${version}:${headerKey}:${revision}:${invalidation}`;
  useEffect(() => {
    if (!enabled || !path || cachedQuery<T>(key) !== undefined) return;
    let active = true;
    const generation = queryCacheGeneration();
    const controller = new AbortController();
    request<T>(path, { headers: JSON.parse(headerKey), signal: controller.signal }).then(
      (data) => {
        if (active) {
          cacheQuery(key, data, Date.now(), generation, path);
          setState({ key, identity, data, loading: false });
        }
      },
      (error) => {
        if (active)
          setState({
            key,
            error:
              error instanceof Error ? error.message : "Something went wrong. Please try again.",
            loading: false,
          });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, key, identity, headerKey, enabled]);
  if (!path) return { data: undefined, loading: false, error: undefined };
  const cached = cachedQuery<T>(key);
  if (cached !== undefined) return { data: cached, loading: false, error: undefined };
  return state.key === key
    ? state
    : state.identity === identity && state.data !== undefined
      ? { data: state.data, loading: false, refreshing: true, error: undefined }
      : { data: undefined, loading: true, error: undefined };
}
