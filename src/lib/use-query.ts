"use client";

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { OwnerQueriesEnabled } from "./owner-query-context";
import { request } from "./data";
import {
  cachedQuery,
  fetchQuery,
  isQueryFresh,
  queryCacheGeneration,
  subscribeQueries,
  queryRevision,
} from "./query-cache";
import { usePaymentLanguage } from "./use-payment-language";

type QueryResult<T> = {
  data?: T;
  loading: boolean;
  error?: string;
  refreshing?: boolean;
  refreshError?: string;
  refetch: () => Promise<T | undefined>;
};
export function useQuery<T>(
  path: string | null,
  headers?: Record<string, string>,
  revision = 0,
): QueryResult<T> {
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
  const identity = `${accountKey}:${path}:${headerKey}`;
  const requestVersion = `${version}:${invalidation}`;
  const key = `${identity}:${requestVersion}:${revision}`;
  const previousRevision = useRef<{ identity: string; revision: number }>(undefined);
  const refetchTask = useRef<() => Promise<T | undefined>>(async () => undefined);
  const refetch = useCallback(() => refetchTask.current(), []);
  useEffect(() => {
    if (!enabled || !path || !accountKey) return;
    // A view's explicit refresh must not make the same shared query stale for other views.
    const force =
      previousRevision.current?.identity === identity &&
      previousRevision.current.revision !== revision;
    previousRevision.current = { identity, revision };
    let active = true;
    const generation = queryCacheGeneration();
    const load = (force = false): Promise<T | undefined> => {
      if (!force && isQueryFresh(identity, requestVersion))
        return Promise.resolve(cachedQuery<T>(identity));
      return fetchQuery<T>(
        identity,
        requestVersion,
        path,
        (signal) => request<T>(path, { headers: JSON.parse(headerKey), signal }),
        force,
      ).then(
        (data) => {
          if (active && generation === queryCacheGeneration())
            setState({ key, identity, data, loading: false });
          return active ? data : undefined;
        },
        (error) => {
          if (active && generation === queryCacheGeneration())
            setState({
              key,
              error:
                error instanceof Error ? error.message : "Something went wrong. Please try again.",
              loading: false,
            });
          return undefined;
        },
      );
    };
    refetchTask.current = () => load(true);
    const resume = () => {
      if (document.visibilityState === "visible") load();
    };
    load(force);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      refetchTask.current = async () => undefined;
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [accountKey, path, key, identity, requestVersion, headerKey, enabled, revision]);
  if (!path) return { data: undefined, loading: false, error: undefined, refetch };
  const cached = enabled ? cachedQuery<T>(identity) : undefined;
  if (cached !== undefined)
    return {
      data: cached,
      loading: false,
      refreshing: !isQueryFresh(identity, requestVersion) && state.key !== key,
      error: undefined,
      refreshError: state.key === key ? state.error : undefined,
      refetch,
    };
  return state.key === key
    ? { ...state, refetch }
    : state.identity === identity && state.data !== undefined
      ? { data: state.data, loading: false, refreshing: true, error: undefined, refetch }
      : { data: undefined, loading: true, error: undefined, refetch };
}
