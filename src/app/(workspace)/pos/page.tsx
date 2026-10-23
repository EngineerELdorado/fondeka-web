"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useToolNavigation } from "@/components/business-tools-provider";
import { Loading } from "@/components/ui";

/** Compatible entry URL. Normal card clicks resolve stores before reaching this page. */
export default function Pos() {
  const { enabled, open } = useToolNavigation();
  const values = useSearchParams();
  const search = values.toString();
  useEffect(() => {
    if (!enabled) open(`/pos${search ? `?${search}` : ""}`);
  }, [enabled, open, search]);
  return <Loading rows={3} />;
}
