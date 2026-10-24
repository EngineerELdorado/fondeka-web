import type { ApiEnvironment, ApiKey } from "./types";
import { apiEnvironment, assertKeyEnvironment } from "./api-environment";
import { updateCachedQueries } from "./query-cache";

/** Whitelist read/update metadata before it can enter a query cache. Issuance bypasses this path. */
export function credentialMetadata(
  value: unknown,
  businessId: number,
  environment?: ApiEnvironment,
): ApiKey {
  const row = value as ApiKey | null;
  if (
    !row ||
    !Number.isSafeInteger(row.id) ||
    row.id < 1 ||
    (row.businessId !== undefined && row.businessId !== businessId) ||
    typeof row.name !== "string" ||
    typeof row.keyPrefix !== "string" ||
    typeof row.enabled !== "boolean" ||
    typeof row.createdAt !== "string" ||
    (row.webhookUrl != null && typeof row.webhookUrl !== "string")
  )
    throw new Error("Could not read credential metadata. Refresh the key list.");
  const result: ApiKey = {
    id: row.id,
    ...(row.businessId === undefined ? {} : { businessId: row.businessId }),
    name: row.name,
    keyPrefix: row.keyPrefix,
    enabled: row.enabled,
    ...(row.webhookUrl == null ? {} : { webhookUrl: row.webhookUrl }),
    createdAt: row.createdAt,
    environment: apiEnvironment(row.environment),
  };
  assertKeyEnvironment([result], environment ?? result.environment!);
  return result;
}

export function credentialMetadataResponse<T>(path: string, method: string, response: T): T {
  const url = new URL(path, "https://portal.invalid");
  const list = /^\/customer-api\/businesses\/(\d+)\/api-keys$/.exec(url.pathname);
  if (method === "GET" && list) {
    if (!Array.isArray(response))
      throw new Error("Could not read credential metadata. Refresh the key list.");
    const environment = apiEnvironment(url.searchParams.get("environment") ?? undefined);
    return response
      .map((row) => credentialMetadata(row, Number(list[1]), environment))
      .filter((row) => row.enabled) as T;
  }
  const update = /^\/customer-api\/businesses\/(\d+)\/api-keys\/(\d+)\/webhook$/.exec(url.pathname);
  if (method === "PATCH" && update) {
    const key = credentialMetadata(response, Number(update[1]));
    if (key.id !== Number(update[2]) || !key.enabled)
      throw new Error("Could not read credential metadata. Refresh the key list.");
    return key as T;
  }
  return response;
}

export function replaceCredentialMetadata(
  accountKey: string,
  businessId: number,
  environment: ApiEnvironment,
  value: unknown,
  generation: number,
) {
  const key = credentialMetadata(value, businessId, environment);
  updateCachedQueries(
    accountKey,
    (path, data) => {
      const url = new URL(path, "https://portal.invalid");
      if (
        url.pathname !== `/customer-api/businesses/${businessId}/api-keys` ||
        apiEnvironment(url.searchParams.get("environment") ?? undefined) !== environment ||
        !Array.isArray(data)
      )
        return;
      return data
        .map((row: ApiKey) => (row.id === key.id ? key : row))
        .filter((row: ApiKey) => row.enabled);
    },
    generation,
  );
}
