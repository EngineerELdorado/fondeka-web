import { conversionIdPattern, parseApiWallets, sandboxAmount, walletCurrency } from "./api-wallets";
import type { SandboxConversion, SandboxConversionInput } from "./types";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Intent = { businessId: number; idempotencyKey: string; body: SandboxConversionInput };
type State = {
  busy?: "quote" | "execute";
  body?: SandboxConversionInput;
  quote?: SandboxConversion;
  intent?: Intent;
  result?: SandboxConversion;
  error?: string;
  blocked?: boolean;
};
const prefix = "fondeka-sandbox-conversion:";
export function sandboxConversionPath(businessId: number, quote = false) {
  return `/customer-api/businesses/${businessId}/sandbox-wallets/convert${quote ? "/quote" : ""}`;
}
export function conversionInput(
  source: string,
  target: string,
  amount: string,
): SandboxConversionInput {
  const sourceCurrency = walletCurrency(source);
  const value = sandboxAmount(amount);
  const targetCurrency = walletCurrency(target);
  if (sourceCurrency === targetCurrency) throw new Error("Choose two different fiat currencies.");
  return { sourceCurrency, targetCurrency, amount: value };
}
export function parseSandboxConversion(
  value: unknown,
  body: SandboxConversionInput,
  status: "QUOTED" | "COMPLETED",
): SandboxConversion {
  const conversion = value as SandboxConversion;
  if (
    !conversion ||
    conversion.environment !== "SANDBOX" ||
    conversion.status !== status ||
    conversion.sourceCurrency !== body.sourceCurrency ||
    conversion.targetCurrency !== body.targetCurrency ||
    conversion.sourceAmount !== body.amount ||
    ![
      conversion.sourceAmount,
      conversion.feeAmount,
      conversion.netSourceAmount,
      conversion.targetAmount,
      conversion.rate,
    ].every((value) => typeof value === "number" && Number.isFinite(value)) ||
    conversion.feeAmount < 0 ||
    conversion.feeAmount >= conversion.sourceAmount ||
    conversion.netSourceAmount <= 0 ||
    conversion.netSourceAmount > conversion.sourceAmount ||
    conversion.targetAmount <= 0 ||
    conversion.targetAmount > 999_999_999_999.99 ||
    conversion.rate <= 0 ||
    (status === "QUOTED"
      ? conversion.id !== null || conversion.createdAt !== null
      : typeof conversion.id !== "string" ||
        !conversionIdPattern.test(conversion.id) ||
        typeof conversion.createdAt !== "string" ||
        !Number.isFinite(Date.parse(conversion.createdAt)))
  )
    throw new Error(
      "The sandbox conversion response could not be confirmed. Refresh or contact support.",
    );
  parseApiWallets([conversion.sourceWallet], "SANDBOX", body.sourceCurrency);
  parseApiWallets([conversion.targetWallet], "SANDBOX", body.targetCurrency);
  return conversion;
}

/** Quotes never create an intent. Only explicit confirmation can submit a stored conversion. */
export class SandboxConversionClient {
  private state: State = {};
  private active = true;
  private generation = 0;
  private listeners = new Set<() => void>();
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
          typeof intent.body?.sourceCurrency !== "string" ||
          typeof intent.body.targetCurrency !== "string" ||
          typeof intent.body.amount !== "number"
        )
          throw new Error("Invalid saved conversion");
        const body = conversionInput(
          intent.body.sourceCurrency,
          intent.body.targetCurrency,
          String(intent.body.amount),
        );
        this.state = {
          intent: { businessId: intent.businessId, idempotencyKey: intent.idempotencyKey, body },
        };
      }
    } catch {
      this.state = {
        blocked: true,
        error:
          "Saved conversion details could not be read. Contact support before starting another conversion.",
      };
    }
  }
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
    this.generation++;
    this.listeners.clear();
  }
  edit() {
    if (!this.active || this.state.intent || this.state.busy === "execute" || this.state.blocked)
      return;
    this.generation++;
    this.update({
      quote: undefined,
      body: undefined,
      busy: undefined,
      error: undefined,
      result: undefined,
    });
  }
  resetCompleted() {
    if (this.state.result) this.edit();
  }
  async preview(source: string, target: string, amount: string) {
    if (
      !this.active ||
      this.state.intent ||
      this.state.busy === "execute" ||
      this.state.blocked ||
      this.state.result
    )
      return;
    const generation = ++this.generation;
    let body: SandboxConversionInput;
    try {
      body = conversionInput(source, target, amount);
    } catch (error) {
      this.update({
        busy: undefined,
        quote: undefined,
        body: undefined,
        error: error instanceof Error ? error.message : "Check your currencies and amount.",
      });
      return;
    }
    this.update({ busy: "quote", body, quote: undefined, error: undefined });
    try {
      const value = await this.options.request<unknown>(
        sandboxConversionPath(this.options.businessId, true),
        { method: "POST", body: JSON.stringify(body) },
      );
      if (!this.active || generation !== this.generation) return;
      this.update({ busy: undefined, quote: parseSandboxConversion(value, body, "QUOTED") });
    } catch (error) {
      if (this.active && generation === this.generation)
        this.update({
          busy: undefined,
          quote: undefined,
          error: error instanceof Error ? error.message : "The quote could not be loaded.",
        });
    }
  }
  async confirm() {
    if (!this.active || this.state.busy || this.state.blocked || this.state.result) return;
    const recovering = !!this.state.intent;
    let intent = this.state.intent;
    try {
      if (!intent) {
        if (!this.state.quote || !this.state.body)
          throw new Error("Preview the conversion before confirming.");
        intent = {
          businessId: this.options.businessId,
          body: { ...this.state.body },
          idempotencyKey: `sbc_${(this.options.uuid ?? (() => crypto.randomUUID()))()}`,
        };
        this.options.storage.setItem(this.storageKey, JSON.stringify(intent));
      }
    } catch (error) {
      this.update({
        error: error instanceof Error ? error.message : "Conversion recovery could not be saved.",
      });
      return;
    }
    this.update({ busy: "execute", intent, error: undefined });
    try {
      const value = await this.options.request<unknown>(
        sandboxConversionPath(this.options.businessId),
        {
          method: "POST",
          headers: { "Idempotency-Key": intent.idempotencyKey },
          body: JSON.stringify(intent.body),
        },
      );
      const result = parseSandboxConversion(value, intent.body, "COMPLETED");
      if (!this.active) return;
      this.options.storage.removeItem(this.storageKey);
      this.update({
        busy: undefined,
        intent: undefined,
        body: undefined,
        quote: undefined,
        result,
        error: undefined,
      });
      this.options.onSettled();
    } catch (error) {
      if (!this.active) return;
      const status = (error as { status?: number } | null)?.status;
      const code = (error as { code?: string } | null)?.code;
      if (
        !recovering &&
        ([400, 403, 404, 422].includes(status ?? 0) ||
          (status === 409 && code === "INVALID_REQUEST"))
      ) {
        try {
          this.options.storage.removeItem(this.storageKey);
          this.update({ intent: undefined, quote: undefined, body: undefined });
        } catch {
          /* Keep the original intent if its recovery record cannot be cleared. */
        }
      }
      this.update({
        busy: undefined,
        error: error instanceof Error ? error.message : "The conversion result is unconfirmed.",
      });
      this.options.onSettled();
    }
  }
}
export function clearSandboxConversionRecovery(storage?: globalThis.Storage, keepAccount?: string) {
  try {
    const target = storage ?? window.sessionStorage;
    for (const key of Object.keys(target))
      if (key.startsWith(prefix) && key !== prefix + keepAccount) target.removeItem(key);
  } catch {
    /* Logout/account switching must work when browser storage is unavailable. */
  }
}
