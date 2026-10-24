"use client";

import { accessToken, customerScope } from "./auth";
import { tokenCustomerScope } from "./session-scope";
import { browserIdentity } from "./device-identity";
import { BrowserDeviceSessions, DeviceError, deviceSessionKey } from "./device-session";
export { isDeviceError } from "./device-session";

const queues = new Map<string, Promise<unknown>>();
async function withDeviceLock<T>(name: string, run: () => Promise<T>): Promise<T> {
  if (navigator.locks) return navigator.locks.request(name, run);
  // Same-tab fallback; persistent identity creation is atomic even without Web Locks.
  const task = (queues.get(name) || Promise.resolve()).catch(() => {}).then(run);
  queues.set(name, task);
  try {
    return await task;
  } finally {
    if (queues.get(name) === task) queues.delete(name);
  }
}
async function deviceCall<T>(account: string, path: string, body?: object): Promise<T> {
  const token = await accessToken();
  if (!token) throw new DeviceError("Your login has expired. Please sign in again.", 401);
  if (tokenCustomerScope(token) !== account || (await customerScope()) !== account)
    throw new DeviceError("Your account changed. Open the tool again.");
  let response: Response;
  try {
    response = await fetch("/api/backend/customer-api/devices/" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": document.documentElement.lang || navigator.language || "en",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new DeviceError("We couldn’t reach Fondeka. Check your connection and try again.");
  }
  const data = await response.json().catch(() => ({}));
  if ((await customerScope().catch(() => undefined)) !== account)
    throw new DeviceError("Your account changed. Open the tool again.");
  if (!response.ok)
    throw new DeviceError(
      data.message || data.detail || data.title || "Device verification failed. Please try again.",
      response.status,
      data.code ?? data.errorCode,
    );
  return data;
}
const sessions = new BrowserDeviceSessions({
  account: customerScope,
  identity: browserIdentity,
  read: () => sessionStorage.getItem(deviceSessionKey),
  write: (value) => sessionStorage.setItem(deviceSessionKey, value),
  clear: () => {
    try {
      sessionStorage.removeItem(deviceSessionKey);
    } catch {
      /* Persistent identity stays intact. */
    }
  },
  call: deviceCall,
  lock: withDeviceLock,
  sign: (key, challenge) =>
    crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(challenge)),
  metadata: () => ({
    deviceName: "Fondeka Business · " + (navigator.platform || "Web browser"),
    preferredLanguage: document.documentElement.lang || navigator.language,
  }),
  now: () => Date.now(),
});
export const deviceHeaders = (accountKey?: string) => sessions.headers(accountKey);
export const ensureDeviceSession = (failedToken?: string) => sessions.ensure(failedToken);
export const registerBrowser = () => sessions.register();
export const checkBrowserApproval = () => sessions.approved();
export function clearDeviceSession() {
  sessions.reset();
}
/** Logout clears ephemeral proof, never the persisted ID or non-exportable key. */
export function resetDeviceIdentityMemory() {
  sessions.reset();
}
