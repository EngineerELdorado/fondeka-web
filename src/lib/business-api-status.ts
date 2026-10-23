import type { BusinessApiPaymentStatus } from "./types";

export const businessApiPaymentStatuses = ["PROCESSING", "COMPLETED", "FAILED"] as const;
export function isBusinessApiPaymentStatus(value: unknown): value is BusinessApiPaymentStatus {
  return typeof value === "string" && businessApiPaymentStatuses.some((status) => status === value);
}
export function isTerminalBusinessApiPayment(status: BusinessApiPaymentStatus) {
  return status === "COMPLETED" || status === "FAILED";
}
