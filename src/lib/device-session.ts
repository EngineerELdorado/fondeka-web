import { deviceBase64, type BrowserIdentity } from "./device-identity";

export const deviceSessionKey = "fondeka-device-session";
export const isDeviceError = (code?: string) => /^(DEVICE_|TRUSTED_DEVICE_)/.test(code ?? "");
export const mayRetryDeviceRead = (method: string, code?: string) =>
  method.toUpperCase() === "GET" &&
  ["DEVICE_SESSION_REQUIRED", "DEVICE_SESSION_EXPIRED"].includes(code || "");
export class DeviceError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code?: string,
  ) {
    super(message);
  }
}
type StoredSession = { accountKey: string; deviceId: string; token: string; expiresAt: number };
export type DeviceRegistration = {
  nextAction: string;
  status: string;
  challenge?: string;
  message?: string;
};
type Dependencies = {
  account: () => Promise<string>;
  identity: (account: string, create: boolean) => Promise<BrowserIdentity | undefined>;
  read: () => string | null;
  write: (value: string) => void;
  clear: () => void;
  call: <T>(account: string, path: string, body?: object) => Promise<T>;
  lock: <T>(name: string, run: () => Promise<T>) => Promise<T>;
  sign: (key: CryptoKey, challenge: string) => Promise<ArrayBuffer>;
  metadata: () => { deviceName: string; preferredLanguage: string };
  now: () => number;
};
export class BrowserDeviceSessions {
  private epoch = 0;
  private renewals = new Map<string, Promise<boolean>>();
  constructor(private deps: Dependencies) {}
  headers(accountKey?: string): Record<string, string> {
    const session = this.session(accountKey);
    return session ? { "X-Device-Id": session.deviceId, "X-Device-Session": session.token } : {};
  }
  private session(accountKey?: string): StoredSession | undefined {
    if (!accountKey) return;
    try {
      const value = JSON.parse(this.deps.read() || "null") as StoredSession;
      if (
        value?.accountKey === accountKey &&
        typeof value.deviceId === "string" &&
        !!value.deviceId &&
        typeof value.token === "string" &&
        !!value.token &&
        Number.isFinite(value.expiresAt) &&
        value.expiresAt > this.deps.now()
      )
        return value;
    } catch {
      /* Invalid/legacy session proof is renewed with the existing identity. */
    }
  }
  reset() {
    this.epoch++;
    this.renewals.clear();
    this.deps.clear();
  }
  private async check(account: string, epoch: number) {
    if (this.epoch !== epoch || (await this.deps.account()) !== account || this.epoch !== epoch)
      throw new DeviceError("Your account changed. Open the tool again.");
  }
  private async verify(
    account: string,
    identity: BrowserIdentity,
    epoch: number,
    challenge?: string,
  ) {
    await this.check(account, epoch);
    if (!challenge)
      challenge = (
        await this.deps.call<{ challenge: string }>(account, "challenge", {
          deviceId: identity.deviceId,
        })
      ).challenge;
    if (typeof challenge !== "string" || !challenge)
      throw new DeviceError("Fondeka did not return a device challenge.");
    const signature = deviceBase64(await this.deps.sign(identity.privateKey, challenge));
    await this.check(account, epoch);
    const proof = await this.deps.call<{ deviceSession: string; expiresInSeconds: number }>(
      account,
      "verify",
      {
        deviceId: identity.deviceId,
        signature,
        algorithm: "SHA256withRSA",
      },
    );
    await this.check(account, epoch);
    if (
      typeof proof.deviceSession !== "string" ||
      !proof.deviceSession ||
      !Number.isFinite(proof.expiresInSeconds) ||
      proof.expiresInSeconds <= 0
    )
      throw new DeviceError("Fondeka did not return a valid device session.");
    const session: StoredSession = {
      accountKey: account,
      deviceId: identity.deviceId,
      token: proof.deviceSession,
      expiresAt:
        this.deps.now() +
        proof.expiresInSeconds * 1000 -
        Math.min(10_000, proof.expiresInSeconds * 100),
    };
    this.deps.write(JSON.stringify(session));
  }
  /** Renew only a persisted identity; never register a replacement or replay a write here. */
  async ensure(failedToken?: string): Promise<boolean> {
    const account = await this.deps.account();
    const current = this.session(account);
    if (current && (!failedToken || current.token !== failedToken)) return true;
    const existing = this.renewals.get(account);
    if (existing) return existing;
    const epoch = this.epoch;
    const task = (async () => {
      const identity = await this.deps.identity(account, false);
      if (!identity) return false;
      return this.deps.lock(`fondeka-device-proof:${account}:${identity.deviceId}`, async () => {
        await this.check(account, epoch);
        const session = this.session(account);
        if (session && (!failedToken || session.token !== failedToken)) return true;
        try {
          await this.verify(account, identity, epoch);
          return true;
        } catch (error) {
          if (error instanceof DeviceError && isDeviceError(error.code)) return false;
          throw error;
        }
      });
    })();
    this.renewals.set(account, task);
    try {
      return await task;
    } finally {
      if (this.renewals.get(account) === task) this.renewals.delete(account);
    }
  }
  async register() {
    const account = await this.deps.account();
    const epoch = this.epoch;
    const identity = await this.deps.identity(account, true);
    if (!identity) throw new DeviceError("The browser identity could not be saved.");
    return this.deps.lock(`fondeka-device-proof:${account}:${identity.deviceId}`, async () => {
      await this.check(account, epoch);
      const response = await this.deps.call<DeviceRegistration>(account, "register", {
        deviceId: identity.deviceId,
        publicKey: identity.publicKey,
        platform: "WEB",
        ...this.deps.metadata(),
      });
      await this.check(account, epoch);
      if (response.nextAction === "VERIFY_DEVICE") {
        await this.verify(account, identity, epoch, response.challenge);
        return { verified: true, message: "" };
      }
      return {
        verified: false,
        message:
          response.message ||
          "Approve this browser from your trusted Fondeka device, then check again.",
      };
    });
  }
  async approved() {
    const account = await this.deps.account();
    const epoch = this.epoch;
    const identity = await this.deps.identity(account, false);
    if (!identity) return false;
    return this.deps.lock(`fondeka-device-proof:${account}:${identity.deviceId}`, async () => {
      await this.check(account, epoch);
      const status = await this.deps.call<{ status: string }>(
        account,
        `status?${new URLSearchParams({ deviceId: identity.deviceId })}`,
      );
      await this.check(account, epoch);
      if (status.status === "TRUSTED") {
        await this.verify(account, identity, epoch);
        return true;
      }
      if (["BLOCKED", "REJECTED", "REVOKED"].includes(status.status))
        throw new DeviceError(
          "This browser was not approved. Contact Fondeka support or use your trusted device.",
        );
      return false;
    });
  }
}
