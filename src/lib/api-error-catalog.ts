import type { ApiEnvironment } from "./types";
import type { ApiPaymentKind } from "./api-catalog";

export const simulationHeader = "X-Simulate-Error-Code";
export type RequestErrorCode = {
  httpStatus: number;
  errorCode: string;
  description: string;
  howToTest: string;
  simulatable: boolean;
  simulationValue?: string | null;
};
export type ProcessingErrorCode = {
  errorCode: string;
  description: string;
  resultingStatus: "FAILED";
  paymentMethodTypes: string[];
  simulatable: boolean;
  simulationValue?: string | null;
};
export type ErrorCatalogEndpoint = {
  operationId: string;
  method: string;
  path: string;
  available: boolean;
  additionalRequestErrorsPossible: boolean;
  requestErrors: RequestErrorCode[];
  processingErrors: ProcessingErrorCode[];
};
export type ApiErrorCatalog = {
  environment: ApiEnvironment;
  simulationHeader: typeof simulationHeader;
  simulationEnabled: boolean;
  endpoints: ErrorCatalogEndpoint[];
};
export type ErrorSimulation = { stage: "request" | "processing"; errorCode: string };
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const code = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z][A-Z0-9_]{0,127}$/.test(value);
function errorEntry(value: unknown): value is Record<string, unknown> {
  return (
    record(value) &&
    code(value.errorCode) &&
    typeof value.description === "string" &&
    typeof value.simulatable === "boolean" &&
    (value.simulationValue == null || code(value.simulationValue)) &&
    (!value.simulatable || code(value.simulationValue))
  );
}
export function parseApiErrorCatalog(value: unknown, environment: ApiEnvironment): ApiErrorCatalog {
  if (
    !record(value) ||
    value.environment !== environment ||
    value.simulationHeader !== simulationHeader ||
    typeof value.simulationEnabled !== "boolean" ||
    !Array.isArray(value.endpoints) ||
    !value.endpoints.every(
      (endpoint) =>
        record(endpoint) &&
        typeof endpoint.operationId === "string" &&
        typeof endpoint.method === "string" &&
        typeof endpoint.path === "string" &&
        endpoint.path.startsWith("/business-api/v1/businesses/{businessId}/") &&
        typeof endpoint.available === "boolean" &&
        typeof endpoint.additionalRequestErrorsPossible === "boolean" &&
        Array.isArray(endpoint.requestErrors) &&
        endpoint.requestErrors.every(
          (error) =>
            errorEntry(error) &&
            Number.isInteger(error.httpStatus) &&
            Number(error.httpStatus) >= 400 &&
            Number(error.httpStatus) <= 599 &&
            typeof error.howToTest === "string",
        ) &&
        Array.isArray(endpoint.processingErrors) &&
        endpoint.processingErrors.every(
          (error) =>
            errorEntry(error) &&
            error.resultingStatus === "FAILED" &&
            Array.isArray(error.paymentMethodTypes) &&
            error.paymentMethodTypes.every(code),
        ),
    )
  )
    throw new Error("Invalid Business API error catalog response.");
  const catalog = value as ApiErrorCatalog;
  if (
    new Set(catalog.endpoints.map((endpoint) => endpoint.operationId)).size !==
      catalog.endpoints.length ||
    catalog.endpoints.some((endpoint) =>
      [endpoint.requestErrors, endpoint.processingErrors].some(
        (list) => new Set(list.map((error) => error.errorCode)).size !== list.length,
      ),
    )
  )
    throw new Error("Duplicate Business API error catalog identifiers.");
  return catalog;
}
export function apiErrorCatalogPath(businessId: number, environment: ApiEnvironment = "LIVE") {
  if (!Number.isSafeInteger(businessId) || businessId <= 0)
    throw new Error("An owned Business ID is required.");
  return `/customer-api/businesses/${businessId}/api-error-codes?${new URLSearchParams({ environment })}`;
}
export function errorCatalogEndpoint(
  catalog: ApiErrorCatalog,
  method: string,
  path: string,
  operationId?: string,
) {
  const matches = (entry: ErrorCatalogEndpoint) => entry.method === method && entry.path === path;
  return (
    catalog.endpoints.find((entry) => entry.operationId === operationId && matches(entry)) ||
    catalog.endpoints.find(matches)
  );
}
export function processingErrorsFor(endpoint: ErrorCatalogEndpoint, kind?: ApiPaymentKind) {
  if (endpoint.method !== "POST" || !/\/(collections|payouts)$/.test(endpoint.path) || !kind)
    return [];
  return endpoint.processingErrors.filter(
    (error) =>
      error.paymentMethodTypes.includes(kind) &&
      (!/^(PAYMENT_NOT_APPROVED|PAYER_INSUFFICIENT_FUNDS)$/.test(error.errorCode) ||
        (kind === "MOBILE_MONEY" && endpoint.path.endsWith("/collections"))),
  );
}
export function simulationHeaders(
  catalog: ApiErrorCatalog | undefined,
  endpoint: ErrorCatalogEndpoint | undefined,
  selection?: ErrorSimulation,
  kind?: ApiPaymentKind,
): Record<string, string> {
  if (
    !catalog ||
    catalog.environment !== "SANDBOX" ||
    !catalog.simulationEnabled ||
    !endpoint?.available ||
    !selection
  )
    return {};
  const entry = (
    selection.stage === "request" ? endpoint.requestErrors : processingErrorsFor(endpoint, kind)
  ).find((error) => error.errorCode === selection.errorCode);
  if (
    !entry?.simulatable ||
    !entry.simulationValue ||
    ["SUCCESS", "PENDING"].includes(entry.simulationValue)
  )
    return {};
  return { [catalog.simulationHeader]: entry.simulationValue };
}
