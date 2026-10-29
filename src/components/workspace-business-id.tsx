"use client";
import { mayMountOwnerData } from "@/lib/business-tools-client";
import { businessDisplayName } from "@/lib/business-profile";
import { useQuery } from "@/lib/use-query";
import { hasToolAccess } from "@/lib/business-tools";
import { useUiText } from "@/lib/use-ui-text";
import type { Business, Page } from "@/lib/types";
import { useBusinessTools, useToolNavigation } from "./business-tools-provider";

export function WorkspaceBusinessId() {
  const uiText = useUiText();
  const { state } = useBusinessTools();
  const { enabled } = useToolNavigation();
  const businesses = useQuery<Page<Business>>(
    hasToolAccess(state.accountAccess, "API") && mayMountOwnerData(state, "/developers", enabled)
      ? "/customer-api/businesses?page=0&size=20"
      : null,
  );
  const business = businesses.data?.content?.[0];
  const name = businessDisplayName(business);
  const id = business?.id;
  const businessId = typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : undefined;
  return (
    <>
      {name && (
        <small className="workspace-business-name" title={name}>
          {name}
        </small>
      )}
      <small title={businesses.error}>
        {uiText("Business ID")}: {businessId ?? (businesses.loading ? "…" : "—")}
      </small>
    </>
  );
}
