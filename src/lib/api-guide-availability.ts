import type { BusinessApiTopic } from "./business-api-docs";

/** Bill payments remain a local development preview until the production launch. */
export function apiGuideAvailable(
  id: BusinessApiTopic["id"],
  mode: string | undefined = process.env.NODE_ENV,
) {
  return id !== "bill-payments" || mode === "development";
}
