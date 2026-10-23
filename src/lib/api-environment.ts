import type { ApiEnvironment, ApiKey, ApiTransaction } from "./types";

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
        !key.keyPrefix.startsWith(expected === "SANDBOX" ? "fdk_biz_test_" : "fdk_biz_") ||
        (expected === "LIVE" && key.keyPrefix.startsWith("fdk_biz_test_")),
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
  if (
    !tx ||
    apiEnvironment(tx.environment) !== expected ||
    (expected === "SANDBOX"
      ? tx.transactionId != null || !tx.reference.startsWith("SBX")
      : tx.reference.startsWith("SBX"))
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
