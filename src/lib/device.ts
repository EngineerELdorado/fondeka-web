"use client";

import { getCurrentUser } from "aws-amplify/auth";
import { accessToken } from "./auth";

const sessionKey = "fondeka-device-session";
interface Identity {
  deviceId: string;
  privateKey: CryptoKey;
  publicKey: string;
}
interface Registration {
  nextAction: string;
  status: string;
  challenge?: string;
  pollAfterSeconds?: number;
  message?: string;
}
export const isDeviceError = (code?: string) => /^(DEVICE_|TRUSTED_DEVICE_)/.test(code ?? "");
export function clearDeviceSession() {
  sessionStorage.removeItem(sessionKey);
}
export function deviceHeaders(): Record<string, string> {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    if (session?.deviceId && session.expiresAt > Date.now())
      return { "X-Device-Id": session.deviceId, "X-Device-Session": session.token };
  } catch {
    /* Registration will restore an invalid or expired session. */
  }
  return {};
}
function base64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const operation = indexedDB.open("fondeka-device-keys", 1);
    operation.onupgradeneeded = () => operation.result.createObjectStore("identities");
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(new Error("Allow browser storage to verify this device."));
  });
}
let identityTask: Promise<Identity> | undefined;
async function identity(): Promise<Identity> {
  const { userId } = await getCurrentUser();
  const db = await openDb();
  try {
    const existing = await new Promise<Identity | undefined>((resolve, reject) => {
      const operation = db.transaction("identities").objectStore("identities").get(userId);
      operation.onsuccess = () => resolve(operation.result);
      operation.onerror = () => reject(operation.error);
    });
    if (existing) return existing;
    const keys = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"],
    );
    const publicKey = base64(await crypto.subtle.exportKey("spki", keys.publicKey));
    const value: Identity = {
      deviceId: crypto.randomUUID(),
      privateKey: keys.privateKey,
      publicKey: `-----BEGIN PUBLIC KEY-----\n${publicKey.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("identities", "readwrite");
      tx.objectStore("identities").put(value, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return value;
  } finally {
    db.close();
  }
}
function getIdentity() {
  return (identityTask ??= identity().catch((error) => {
    identityTask = undefined;
    throw error;
  }));
}
export function resetDeviceIdentityMemory() {
  identityTask = undefined;
  clearDeviceSession();
}
async function deviceCall<T>(path: string, body?: object): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error("Your login has expired. Please sign in again.");
  const response = await fetch(`/api/backend/customer-api/devices/${path}`, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      data.message || data.detail || data.title || "Device verification failed. Please try again.",
    );
  return data;
}
async function verify(key: Identity, challenge?: string) {
  if (!challenge)
    challenge = (await deviceCall<{ challenge: string }>("challenge", { deviceId: key.deviceId }))
      .challenge;
  const signature = base64(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key.privateKey,
      new TextEncoder().encode(challenge),
    ),
  );
  const session = await deviceCall<{ deviceSession: string; expiresInSeconds: number }>("verify", {
    deviceId: key.deviceId,
    signature,
    algorithm: "SHA256withRSA",
  });
  if (!session.deviceSession) throw new Error("Fondeka did not return a device session.");
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({
      deviceId: key.deviceId,
      token: session.deviceSession,
      expiresAt: Date.now() + session.expiresInSeconds * 1000 - 10_000,
    }),
  );
}
export async function registerBrowser() {
  const key = await getIdentity();
  const response = await deviceCall<Registration>("register", {
    deviceId: key.deviceId,
    publicKey: key.publicKey,
    platform: "WEB",
    deviceName: `Fondeka Business · ${navigator.platform || "Web browser"}`,
    preferredLanguage: navigator.language,
  });
  if (response.nextAction === "VERIFY_DEVICE") {
    await verify(key, response.challenge);
    return { verified: true, message: "" };
  }
  return {
    verified: false,
    message:
      response.message ||
      "Approve this browser from your trusted Fondeka device, then check again.",
  };
}
export async function checkBrowserApproval() {
  const key = await getIdentity();
  const status = await deviceCall<{ status: string }>(
    `status?${new URLSearchParams({ deviceId: key.deviceId })}`,
  );
  if (status.status === "TRUSTED") {
    await verify(key);
    return true;
  }
  if (["BLOCKED", "REJECTED", "REVOKED"].includes(status.status))
    throw new Error(
      "This browser was not approved. Contact Fondeka support or use your trusted device.",
    );
  return false;
}
