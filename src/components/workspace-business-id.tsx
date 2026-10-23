"use client";
import { mayMountOwnerData } from "@/lib/business-tools-client";
import { useQuery } from "@/lib/use-query";
import { useUiText } from "@/lib/use-ui-text";
import type { Business, Page } from "@/lib/types";
import { useBusinessTools, useToolNavigation } from "./business-tools-provider";

export function WorkspaceBusinessId() {
  const uiText = useUiText();
  const { state } = useBusinessTools();
  const { enabled } = useToolNavigation();
  const businesses = useQuery<Page<Business>>(
    mayMountOwnerData(state, "/developers", enabled)
      ? "/customer-api/businesses?page=0&size=20"
      : null,
  );
  const business = businesses.data?.content?.[0];
  // Default Businesses are provisioned with "Business <account reference or ID>".
  // That generated identity is not a customer-provided business name.
  const name = [business?.name, business?.legalName]
    .map((value) => value?.trim())
    .find((value) => value && !/^(?:Business\s+)?(?:FDK\d+|\d+)$/i.test(value))
    ?.replace(/^Business\s+/i, "");
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
