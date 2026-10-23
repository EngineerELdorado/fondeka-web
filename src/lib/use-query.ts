"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { request } from "./data";

export function useQuery<T>(path: string | null, headers?: Record<string, string>, revision = 0) {
  const { version, accountKey } = useWorkspace();
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({
    key: "",
    loading: true,
  });
  const headerKey = JSON.stringify(headers ?? {});
  const key = `${accountKey}:${path}:${version}:${headerKey}:${revision}`;
  useEffect(() => {
    if (!path) return;
    let active = true;
    const controller = new AbortController();
    request<T>(path, { headers: JSON.parse(headerKey), signal: controller.signal }).then(
      (data) => {
        if (active) setState({ key, data, loading: false });
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
  }, [path, key, headerKey]);
  if (!path) return { data: undefined, loading: false, error: undefined };
  return state.key === key ? state : { data: undefined, loading: true, error: undefined };
}
