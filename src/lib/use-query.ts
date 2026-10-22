"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { request } from "./data";

export function useQuery<T>(path: string | null) {
  const { version } = useWorkspace();
  const [state, setState] = useState<{ key: string; data?: T; error?: string; loading: boolean }>({
    key: "",
    loading: true,
  });
  const key = `${path}:${version}`;
  useEffect(() => {
    if (!path) return;
    let active = true;
    request<T>(path).then(
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
    };
  }, [path, key]);
  if (!path) return { data: undefined, loading: false, error: undefined };
  return state.key === key ? state : { data: undefined, loading: true, error: undefined };
}
