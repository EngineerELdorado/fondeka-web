import type { Store } from "./types";
import { staffPermissions } from "./commerce";
import { hasToolAccess, type BusinessToolsAccess } from "./business-tools";

export function sharedStoreView(values: URLSearchParams, access?: BusinessToolsAccess | null) {
  return (
    values.get("view") === "shared" ||
    (!values.has("view") &&
      !!access &&
      !hasToolAccess(access, values.get("mode") === "pos" ? "POS" : "ONLINE_STORES") &&
      access.commerceAccess?.hasSharedStores === true)
  );
}

export const sharedStoresEndpoint = "/customer-api/commerce/stores/shared";
export function sharedStoresPath(page = 0, permission?: string, size = 20) {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100 ||
    (permission !== undefined && !staffPermissions.some((value) => value === permission))
  )
    throw new Error("Invalid shared-store query.");
  return `${sharedStoresEndpoint}?${new URLSearchParams({ page: String(page), size: String(size), ...(permission ? { permission } : {}) })}`;
}
export function storeOwnerAccessRequired(value: unknown): number | undefined {
  const body = value as {
    access?: Record<string, unknown>;
    details?: { access?: Record<string, unknown> };
  } | null;
  const access = body?.access ?? body?.details?.access;
  return access?.paymentResponsibility === "STORE_OWNER" &&
    access.staffPaymentRequired === false &&
    access.accessType === "STAFF" &&
    Number.isSafeInteger(access.storeId) &&
    Number(access.storeId) > 0
    ? Number(access.storeId)
    : undefined;
}
export function isStoreWorkspace(destination: string) {
  return /^\/stores\/\d+(?:\/pos)?$/.test(destination.split("?")[0]);
}
export function storeWorkspaceId(destination: string) {
  return /^\/stores\/(\d+)(?:\/pos)?$/.exec(destination.split("?")[0])?.[1];
}
export function storeVisible(store: Store) {
  return (
    ["OWNER", "STAFF"].includes(store.accessType || "") &&
    (!store.capabilities || store.capabilities.canViewStore === true)
  );
}
