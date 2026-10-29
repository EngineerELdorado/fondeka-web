"use client";

import { accessToken, customerScope } from "./auth";
import { clearDeviceSession, deviceHeaders, ensureDeviceSession, isDeviceError } from "./device";
import { DeviceError, mayRetryDeviceRead } from "./device-session";
import { isBusinessTool, needsBusinessToolsRecovery } from "./business-tools";
import { clearQueryCache, invalidateQueryPaths, forgetCommerceQueries } from "./query-cache";
import { tokenCustomerScope } from "./session-scope";
import { storeOwnerAccessRequired } from "./shared-stores";

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
      const ownerActivationStore =
        response.status === 403 && code === "BUSINESS_TOOLS_ACCESS_REQUIRED"
          ? storeOwnerAccessRequired(body)
          : undefined;
      // Only safe reads can resume after a server-expired proof. Never replay a write.
      if (
        attempt === 0 &&
        [401, 403].includes(response.status) &&
        mayRetryDeviceRead(init.method || "GET", code)
      ) {
        device = await proof(device["X-Device-Session"]);
        continue;
      }
      // A freshly renewed proof was already tried. Keep the view mounted so its error can
      // be shown instead of verification remounting it and starting the same read again.
      const renewedProofRejected = attempt > 0 && mayRetryDeviceRead(init.method || "GET", code);
      if (response.status === 401 && !renewedProofRejected) clearQueryCache();
      if (isDeviceError(code)) {
        if (!renewedProofRejected) {
          clearDeviceSession();
          window.dispatchEvent(new CustomEvent("fondeka:device-required", { detail: code }));
        }
      } else if (response.status === 401)
        window.dispatchEvent(new Event("fondeka:session-expired"));
      else if (!ownerActivationStore && needsBusinessToolsRecovery(response.status, code, path)) {
        invalidateQueryPaths([path.split("?")[0]]);
        const deniedAccess = body?.access ?? body?.details?.access;
        const tool = deniedAccess?.requestedTool ?? deniedAccess?.tool;
        window.dispatchEvent(
          new CustomEvent("fondeka:business-tools-required", {
            detail: { accountKey, tool: isBusinessTool(tool) ? tool : undefined },
          }),
        );
      }
      const message =
        (ownerActivationStore
          ? document.documentElement.lang.startsWith("fr")
            ? "Le propriétaire de la boutique doit activer son accès. Contactez-le pour continuer ; aucun achat personnel n’est requis pour cette boutique partagée."
            : "The store owner needs to activate access. Contact the owner to continue; you do not need a personal purchase for this shared store."
          : undefined) ||
        body?.message ||
        body?.detail ||
        body?.title ||
        `The request failed (${response.status}). Please try again.`;
      if (
        [403, 404].includes(response.status) &&
        !isDeviceError(code) &&
        path.startsWith("/customer-api/commerce/")
      ) {
        forgetCommerceQueries(accountKey, path);
        window.dispatchEvent(
          new CustomEvent("fondeka:store-access-changed", {
            detail: {
              accountKey,
              message,
              storeId:
                ownerActivationStore ??
                (Number(/^\/customer-api\/commerce\/stores\/(\d+)/.exec(path)?.[1]) || undefined),
            },
          }),
        );
      }
      throw new ApiError(message, response.status, code);
    }
    return body as T;
  }
  throw new ApiError(
    "Device verification failed. Please try again.",
    401,
    "DEVICE_SESSION_EXPIRED",
  );
}
