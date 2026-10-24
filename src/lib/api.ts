"use client";

import { accessToken, customerScope } from "./auth";
import { clearDeviceSession, deviceHeaders, ensureDeviceSession, isDeviceError } from "./device";
import { DeviceError, mayRetryDeviceRead } from "./device-session";
import { isBusinessTool, needsBusinessToolsRecovery } from "./business-tools";
import { clearQueryCache, invalidateQueryPaths } from "./query-cache";
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
  const proof = async (failedToken?: string) => {
    try {
      if (!(await ensureDeviceSession(failedToken))) {
        clearDeviceSession();
        clearQueryCache();
        window.dispatchEvent(new Event("fondeka:device-required"));
        throw new ApiError("Verify this browser to continue.", 401, "DEVICE_SESSION_REQUIRED");
      }
      if (accountKey !== (await customerScope().catch(() => undefined))) {
        window.dispatchEvent(
          new CustomEvent("fondeka:account-changed", {
            detail: { previousAccountKey: accountKey },
          }),
        );
        throw new ApiError("Your account changed. Open the tool again.", 0);
      }
      const headers = deviceHeaders(accountKey);
      if (!headers["X-Device-Session"]) {
        window.dispatchEvent(new Event("fondeka:device-required"));
        throw new ApiError("Verify this browser to continue.", 401, "DEVICE_SESSION_REQUIRED");
      }
      return headers;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DeviceError && error.status === 401 && !isDeviceError(error.code)) {
        clearDeviceSession();
        clearQueryCache();
        window.dispatchEvent(new Event("fondeka:session-expired"));
      }
      throw new ApiError(
        error instanceof Error ? error.message : "Device verification failed. Please try again.",
        error instanceof DeviceError ? error.status : 0,
        error instanceof DeviceError ? error.code : undefined,
      );
    }
  };
  let device = await proof();
  for (let attempt = 0; attempt < 2; attempt++) {
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
          ...device,
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
      // Only safe reads can resume after a server-expired proof. Never replay a write.
      if (
        attempt === 0 &&
        [401, 403].includes(response.status) &&
        mayRetryDeviceRead(init.method || "GET", code)
      ) {
        device = await proof(device["X-Device-Session"]);
        continue;
      }
      if (response.status === 401) clearQueryCache();
      if (isDeviceError(code)) {
        clearDeviceSession();
        window.dispatchEvent(new CustomEvent("fondeka:device-required", { detail: code }));
      } else if (response.status === 401)
        window.dispatchEvent(new Event("fondeka:session-expired"));
      else if (needsBusinessToolsRecovery(response.status, code, path)) {
        invalidateQueryPaths([path.split("?")[0]]);
        const deniedAccess = body?.access ?? body?.details?.access;
        const tool = deniedAccess?.requestedTool ?? deniedAccess?.tool;
        window.dispatchEvent(
          new CustomEvent("fondeka:business-tools-required", {
            detail: { accountKey, tool: isBusinessTool(tool) ? tool : undefined },
          }),
        );
      }
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
  throw new ApiError(
    "Device verification failed. Please try again.",
    401,
    "DEVICE_SESSION_EXPIRED",
  );
}
