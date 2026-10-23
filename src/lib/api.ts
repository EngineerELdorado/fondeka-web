"use client";

import { accessToken, customerScope } from "./auth";
import { deviceHeaders, isDeviceError } from "./device";
import { needsBusinessToolsRecovery } from "./business-tools";
import { clearQueryCache } from "./query-cache";
import { tokenCustomerScope } from "./session-scope";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token: string | undefined;
  let accountKey: string | undefined;
  try {
    token = await accessToken();
    if (token) {
      accountKey = tokenCustomerScope(token);
    }
  } catch {
    /* Route an invalid Cognito session back to login. */
  }
  if (!token || !accountKey) {
    window.dispatchEvent(new Event("fondeka:session-expired"));
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  if (accountKey !== (await customerScope().catch(() => undefined))) {
    window.dispatchEvent(
      new CustomEvent("fondeka:account-changed", { detail: { previousAccountKey: accountKey } }),
    );
    throw new ApiError("Your account changed. Open the tool again.", 0);
  }
  let response: Response;
  try {
    response = await fetch(`/api/backend${path}`, {
      ...init,
      cache: "no-store",
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(25_000)])
        : AbortSignal.timeout(25_000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Language": document.documentElement.lang || navigator.language || "en",
        Authorization: `Bearer ${token}`,
        ...deviceHeaders(),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("We couldn’t reach Fondeka. Check your connection and try again.", 0);
  }
  const body = await response.json().catch(() => null);
  // Discard a response (and its errors) from a previous signed-in account.
  if ((await customerScope().catch(() => undefined)) !== accountKey) {
    window.dispatchEvent(
      new CustomEvent("fondeka:account-changed", { detail: { previousAccountKey: accountKey } }),
    );
    throw new ApiError("Your account changed. Open the tool again.", 0);
  }
  if (!response.ok) {
    const code = body?.code ?? body?.errorCode;
    if (response.status === 401 || code === "BUSINESS_TOOLS_ACCESS_REQUIRED") clearQueryCache();
    if (isDeviceError(code))
      window.dispatchEvent(new CustomEvent("fondeka:device-required", { detail: code }));
    else if (response.status === 401) window.dispatchEvent(new Event("fondeka:session-expired"));
    else if (needsBusinessToolsRecovery(response.status, code, path))
      window.dispatchEvent(
        new CustomEvent("fondeka:business-tools-required", { detail: { accountKey } }),
      );
    throw new ApiError(
      body?.message ||
        body?.detail ||
        body?.title ||
        `The request failed (${response.status}). Please try again.`,
      response.status,
      code,
    );
  }
  return body as T;
}
