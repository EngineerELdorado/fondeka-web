import type { BusinessApiPaymentStatus } from "./types";

export const businessApiPaymentStatuses = [
  "ACCEPTED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;
export function isBusinessApiPaymentStatus(value: unknown): value is BusinessApiPaymentStatus {
  return typeof value === "string" && businessApiPaymentStatuses.some((status) => status === value);
}
export function isTerminalBusinessApiPayment(status: BusinessApiPaymentStatus) {
  return status === "COMPLETED" || status === "FAILED";
}
export function isPendingBusinessApiPayment(status: unknown): status is "ACCEPTED" | "PROCESSING" {
  return status === "ACCEPTED" || status === "PROCESSING";
}
