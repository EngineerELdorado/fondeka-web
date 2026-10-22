"use client";

import { accessToken } from "./auth";
import { deviceHeaders, isDeviceError } from "./device";

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
  try {
    token = await accessToken();
  } catch {
    /* Route an invalid Cognito session back to login. */
  }
  if (!token) {
    window.dispatchEvent(new Event("fondeka:session-expired"));
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }
  let response: Response;
  try {
    response = await fetch(`/api/backend${path}`, {
      ...init,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(25_000),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...deviceHeaders(),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("We couldn’t reach Fondeka. Check your connection and try again.", 0);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (isDeviceError(body?.errorCode))
      window.dispatchEvent(new CustomEvent("fondeka:device-required", { detail: body?.errorCode }));
    else if (response.status === 401) window.dispatchEvent(new Event("fondeka:session-expired"));
    throw new ApiError(
      body?.message ||
        body?.detail ||
        body?.title ||
        `The request failed (${response.status}). Please try again.`,
      response.status,
      body?.errorCode,
    );
  }
  return body as T;
}
