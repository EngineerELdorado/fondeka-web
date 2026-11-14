"use client";

import { BusinessToolLink as Link } from "./business-tool-link";
import { useUiText } from "@/lib/use-ui-text";
import { useUrlState } from "@/lib/use-url-state";
import { sharedStoreView } from "@/lib/shared-stores";
import { useBusinessTools } from "./business-tools-provider";

export function StoreSectionLinks({
  pathname,
  onNavigate,
  className = "",
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const uiText = useUiText();
  const { values } = useUrlState();
  const { state } = useBusinessTools();
  const active = pathname.startsWith("/stores");
  const shared = pathname === "/stores" && sharedStoreView(values, state.accountAccess);

  return (
    <div className={`store-section-links ${className}`}>
      <Link
        href="/stores?view=owned"
        onClick={onNavigate}
        className={active && !shared ? "active" : ""}
        aria-current={active && !shared ? "page" : undefined}
      >
        {uiText("My Stores")}
      </Link>
      <Link
        href="/stores?view=shared"
        onClick={onNavigate}
        className={active && shared ? "active" : ""}
        aria-current={active && shared ? "page" : undefined}
      >
        {uiText("Stores shared with me")}
      </Link>
    </div>
  );
}
