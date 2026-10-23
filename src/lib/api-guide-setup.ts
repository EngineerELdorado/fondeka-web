import type { Business } from "./types";

export type ApiGuideSetup = {
  business?: Business;
  loading: boolean;
  error?: string;
  refresh: () => void;
};

export function guideCredentialHref(businessId?: number) {
  if (!Number.isSafeInteger(businessId) || Number(businessId) <= 0) return;
  return `/developers?business=${businessId}&environment=SANDBOX&createKey=1`;
}
