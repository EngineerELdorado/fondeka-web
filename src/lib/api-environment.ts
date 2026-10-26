import type { ApiEnvironment, ApiKey, ApiTransaction } from "./types";
import { isBusinessApiPaymentStatus } from "./business-api-status";

const sandboxKeyPrefixes = ["fdk_sandbox_", "fdk_biz_sandbox_", "fdk_biz_test_"];
const liveKeyPrefixes = ["fdk_live_", "fdk_biz_live_", "fdk_biz_"];

export function resolveApiEnvironment(
  selected: string | null,
  current: ApiEnvironment,
): ApiEnvironment {
  return selected === "LIVE" || selected === "SANDBOX" ? selected : current;
}

/** Environment changes return to a list; they never carry a payment or key-creation dialog. */
export function apiEnvironmentSelection(environment: ApiEnvironment) {
  return {
    environment,
    apiPage: null,
    apiReference: null,
    apiDetailBusiness: null,
    createKey: null,
    flow: null,
    step: null,
  };
}

/** Missing environment is supported only for historical LIVE responses. */
export function apiEnvironment(value: unknown): ApiEnvironment {
  if (value === undefined || value === "LIVE") return "LIVE";
  if (value === "SANDBOX") return "SANDBOX";
  throw new Error("Fondeka returned an unrecognized API environment. Refresh or contact support.");
}
export function assertKeyEnvironment(keys: ApiKey[], expected: ApiEnvironment) {
  if (
    !Array.isArray(keys) ||
    keys.some(
      (key) =>
        !key ||
        typeof key.keyPrefix !== "string" ||
        apiEnvironment(key.environment) !== expected ||
        (expected === "SANDBOX"
          ? !sandboxKeyPrefixes.some((prefix) => key.keyPrefix.startsWith(prefix))
          : !liveKeyPrefixes.some((prefix) => key.keyPrefix.startsWith(prefix)) ||
            sandboxKeyPrefixes.some((prefix) => key.keyPrefix.startsWith(prefix))),
    )
  )
    throw new Error(
      "These credentials do not match the selected API environment. Refresh or contact support.",
    );
}
export function assertTransactionEnvironment(
  tx: ApiTransaction["transaction"],
  expected: ApiEnvironment,
) {
  if (tx && !isBusinessApiPaymentStatus(tx.status))
    throw new Error(
      "The backend returned an outdated Business API payment status. Refresh or contact support.",
    );
  if (
    !tx ||
    tx.environment !== expected ||
    typeof tx.fondekaReference !== "string" ||
    !tx.fondekaReference
  )
    throw new Error(
      "This activity does not match the selected API environment. Refresh or contact support.",
    );
}
export function apiKeysPath(businessId: number, environment: ApiEnvironment) {
  return `/customer-api/businesses/${encodeURIComponent(businessId)}/api-keys?${new URLSearchParams({ environment })}`;
}
export function apiTransactionPath(
  businessId: number,
  reference: string,
  environment: ApiEnvironment,
) {
  return `/customer-api/businesses/${encodeURIComponent(businessId)}/api-transactions/${encodeURIComponent(reference)}?${new URLSearchParams({ environment })}`;
}
