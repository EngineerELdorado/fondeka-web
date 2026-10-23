import { parseSandboxEntry, sandboxFundingBody, sandboxTopUpPath } from "./api-wallets";
import type { SandboxWalletEntry } from "./types";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Intent = {
  businessId: number;
  idempotencyKey: string;
  body: { currency: string; amount: number };
};
type State = {
  busy: boolean;
  intent?: Intent;
  result?: SandboxWalletEntry;
  error?: string;
  blocked?: boolean;
};
const prefix = "fondeka-sandbox-funding:";

/** Only a test-funding intent is stored. No token, credential or payment instrument is persisted. */
export class SandboxFundingClient {
  private state: State = { busy: false };
  private listeners = new Set<() => void>();
  private active = true;
  private storageKey: string;
  constructor(
    private options: {
      accountKey: string;
      businessId: number;
      storage: Storage;
      request: <T>(path: string, init: RequestInit) => Promise<T>;
      onSettled: () => void;
      uuid?: () => string;
    },
  ) {
    this.storageKey = prefix + options.accountKey;
    try {
      const saved = options.storage.getItem(this.storageKey);
      if (saved) {
        const intent = JSON.parse(saved) as Intent;
        if (
          !Number.isSafeInteger(intent.businessId) ||
          intent.businessId < 1 ||
          typeof intent.idempotencyKey !== "string" ||
          !/^[A-Za-z0-9_.:-]{1,128}$/.test(intent.idempotencyKey) ||
          typeof intent.body?.amount !== "number" ||
          !Number.isFinite(intent.body.amount) ||
          typeof intent.body.currency !== "string"
        )
          throw new Error("Invalid funding intent");
        const body = sandboxFundingBody(intent.body.currency, String(intent.body.amount));
        if (body.currency !== intent.body.currency) throw new Error("Invalid funding currency");
        this.state = {
          busy: false,
          intent: { businessId: intent.businessId, idempotencyKey: intent.idempotencyKey, body },
        };
      }
    } catch {
      this.state = {
        busy: false,
        blocked: true,
        error:
          "Saved test funding could not be read. Contact support before starting another funding request.",
      };
      this.recoveryUnavailable = true;
    }
  }
  private recoveryUnavailable = false;
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(change: Partial<State>) {
    if (!this.active) return;
    this.state = { ...this.state, ...change };
    this.listeners.forEach((listener) => listener());
  }
  dispose() {
    this.active = false;
    this.listeners.clear();
  }
  resetCompleted() {
    if (this.state.result) this.update({ result: undefined, error: undefined });
  }
  async submit(currency: string, amount: string) {
    if (!this.active || this.state.busy || this.recoveryUnavailable || this.state.result) return;
    const recovering = !!this.state.intent;
    let intent = this.state.intent;
    try {
      if (!intent) {
        const body = sandboxFundingBody(currency, amount);
        intent = {
          businessId: this.options.businessId,
          body,
          idempotencyKey: `sbt_${(this.options.uuid ?? (() => crypto.randomUUID()))()}`,
        };
        // Save before sending so a reload or lost response can only retry this exact request.
        this.options.storage.setItem(this.storageKey, JSON.stringify(intent));
      }
    } catch (error) {
      this.update({
        error:
          error instanceof Error
            ? error.message
            : "Save your test-funding recovery information before continuing.",
      });
      return;
    }
    this.update({ busy: true, intent, error: undefined });
    try {
      const value = await this.options.request<unknown>(sandboxTopUpPath(intent.businessId), {
        method: "POST",
        headers: { "Idempotency-Key": intent.idempotencyKey },
        body: JSON.stringify(intent.body),
      });
      const entry = parseSandboxEntry(value, intent.body.currency);
      // A replay through another owned Business returns the original movement and balance snapshot.
      if (entry.kind !== "TOP_UP" || entry.amount !== intent.body.amount)
        throw new Error("The returned funding movement does not match this request.");
      if (!this.active) return;
      this.options.storage.removeItem(this.storageKey);
      this.update({ busy: false, intent: undefined, result: entry, error: undefined });
      this.options.onSettled();
    } catch (error) {
      if (!this.active) return;
      const status = (error as { status?: number })?.status;
      // Validation/permission rejections are definitive. Conflicts, rate limits, authentication
      // recovery and uncertain transport/server results retain the original key and body.
      if (!recovering && (status === 400 || status === 403 || status === 404 || status === 422)) {
        try {
          this.options.storage.removeItem(this.storageKey);
          this.update({ intent: undefined });
        } catch {
          /* Retain the intent if its recovery record cannot be cleared. */
        }
      }
      this.update({
        busy: false,
        error: error instanceof Error ? error.message : "Test funding could not be confirmed.",
      });
      this.options.onSettled();
    }
  }
}
export function clearSandboxFundingRecovery(storage?: globalThis.Storage, keepAccount?: string) {
  try {
    const target = storage ?? window.sessionStorage;
    for (const key of Object.keys(target))
      if (key.startsWith(prefix) && key !== prefix + keepAccount) target.removeItem(key);
  } catch {
    /* Account recovery and logout must work when browser storage is unavailable. */
  }
}
