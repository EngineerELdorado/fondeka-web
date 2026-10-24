"use client";
import { useEffect } from "react";
import type { ApiGuideSetup } from "./api-guide-setup";
import {
  apiErrorCatalogPath,
  errorCatalogEndpoint,
  parseApiErrorCatalog,
} from "./api-error-catalog";
import { useQuery } from "./use-query";

export function useApiErrorCatalog(
  setup: ApiGuideSetup | undefined,
  method: string,
  path: string,
  operationId?: string,
) {
  const environment = setup?.environment ?? "LIVE";
  const businessId = setup?.business?.id;
  const query = useQuery<unknown>(
    businessId && !setup?.loading && !setup?.error
      ? apiErrorCatalogPath(businessId, environment)
      : null,
  );
  const { refetch } = query;
  useEffect(() => {
    if (businessId && !setup?.loading && !setup?.error) void refetch();
  }, [businessId, environment, setup?.loading, setup?.error, refetch]);
  let catalog;
  let endpoint;
  let invalid = false;
  if (query.data !== undefined) {
    try {
      catalog = parseApiErrorCatalog(query.data, environment);
      endpoint = errorCatalogEndpoint(catalog, method, path, operationId);
      invalid = !endpoint;
    } catch {
      invalid = true;
    }
  }
  return {
    ...query,
    catalog: invalid ? undefined : catalog,
    endpoint: invalid ? undefined : endpoint,
    invalid,
  };
}
