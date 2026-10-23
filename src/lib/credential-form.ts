import type { ApiEnvironment, ApiKey } from "./types";
import { apiEnvironment } from "./api-environment";

export interface IssuedCredentials {
  credential: ApiKey;
  apiKey: string;
  webhookSecret: string;
}

export function parseIssuedCredentials(
  value: unknown,
  environment: ApiEnvironment = "LIVE",
): IssuedCredentials {
  const message =
    "Credential generation could not be confirmed. Check the key list before trying again.";
  if (!value || typeof value !== "object") throw new Error(message);
  const row = value as Record<string, unknown>;
  const credential = row.credential as ApiKey | undefined;
  if (
    !credential ||
    !Number.isSafeInteger(credential.id) ||
    credential.id < 1 ||
    apiEnvironment(credential.environment) !== environment ||
    typeof row.apiKey !== "string" ||
    !(
      environment === "SANDBOX" ? /^fdk_biz_test_[A-Za-z0-9_-]{43}$/ : /^fdk_biz_[A-Za-z0-9_-]{43}$/
    ).test(row.apiKey) ||
    typeof row.webhookSecret !== "string" ||
    !/^whsec_[A-Za-z0-9_-]{43}$/.test(row.webhookSecret)
  )
    throw new Error(message);
  return value as IssuedCredentials;
}

export function credentialPayload(
  name: string,
  webhookUrl: string,
  environment: ApiEnvironment = "LIVE",
) {
  apiEnvironment(environment);
  const label = name.trim();
  const destination = webhookUrl.trim();
  if (!label || label.length > 100)
    throw new Error("Enter an integration name of 1–100 characters.");
  if (!destination || destination.length > 2048)
    throw new Error("Enter a webhook URL of up to 2048 characters.");
  let target: URL;
  try {
    target = new URL(destination);
  } catch {
    throw new Error("Enter a valid public HTTPS webhook URL.");
  }
  if (
    target.protocol !== "https:" ||
    target.username ||
    target.password ||
    target.hash ||
    (target.port && target.port !== "443")
  )
    throw new Error(
      "Use a public HTTPS webhook URL on port 443, without URL credentials or fragments.",
    );
  // The backend performs authoritative public-address/DNS validation.
  return { name: label, webhookUrl: target.toString(), environment };
}
