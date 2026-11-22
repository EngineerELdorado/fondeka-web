type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
type Intent = { path: string; key: string; body: string };
type State = {
  busy: boolean;
  intent?: Intent;
  error?: string;
  blocked?: boolean;
  completed?: boolean;
};
const prefix = "fondeka-pos-command:";
const initial: State = { busy: false };

/** A lost response must never become a second installment or correction after a reload. */
export class PosCommand {
  private state: State = initial;
  private listeners = new Set<() => void>();
  private key: string;
  constructor(
    private options: {
      accountKey: string;
      path: string;
      storage: Storage;
      request: <T>(path: string, init: RequestInit) => Promise<T>;
      uuid?: () => string;
    },
  ) {
    this.key = prefix + options.accountKey + ":" + options.path;
    try {
      const saved = options.storage.getItem(this.key);
      if (saved) {
        const intent = JSON.parse(saved) as Intent;
        if (
          intent.path !== options.path ||
          !/^pos_[A-Za-z0-9_-]{1,100}$/.test(intent.key) ||
          typeof intent.body !== "string" ||
          intent.body.length > 100000 ||
          !JSON.parse(intent.body) ||
          typeof JSON.parse(intent.body) !== "object"
        )
          throw new Error("Invalid saved operation.");
        this.state = { busy: false, intent };
      }
    } catch {
      this.state = {
        busy: false,
        blocked: true,
        error:
          "The saved operation could not be read. Contact support before submitting another update.",
      };
    }
  }
  getSnapshot = () => this.state;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  resetCompleted() {
    if (this.state.completed) this.update({ completed: false, error: undefined });
  }
  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  async submit<T>(body: object, validate: (value: unknown) => T): Promise<T | undefined> {
    if (this.state.busy || this.state.blocked || this.state.completed) return;
    const recovering = !!this.state.intent;
    let intent = this.state.intent;
    try {
      if (!intent) {
        intent = {
          path: this.options.path,
          key: "pos_" + (this.options.uuid ?? (() => crypto.randomUUID()))(),
          body: JSON.stringify(body),
        };
        this.options.storage.setItem(this.key, JSON.stringify(intent));
      }
    } catch {
      this.update({
        error:
          "Enable session storage before saving this update so a lost response can be recovered safely.",
      });
      return;
    }
    this.update({ busy: true, intent, error: undefined });
    try {
      const response = await this.options.request<unknown>(intent.path, {
        method: "POST",
        headers: { "Idempotency-Key": intent.key },
        body: intent.body,
      });
      const result = validate(response);
      this.options.storage.removeItem(this.key);
      this.update({ busy: false, intent: undefined, completed: true });
      return result;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      const code = (error as { code?: string })?.code;
      if (
        !recovering &&
        ([400, 403, 404, 405, 422, 501].includes(status ?? 0) ||
          (status === 409 &&
            ["SALE_VERSION_CONFLICT", "EXPENSE_VERSION_CONFLICT"].includes(code || "")))
      ) {
        try {
          this.options.storage.removeItem(this.key);
          this.update({ intent: undefined });
        } catch {
          /* Preserve the original intent when recovery storage cannot be cleared. */
        }
      }
      this.update({
        busy: false,
        error: error instanceof Error ? error.message : "The update could not be confirmed.",
      });
    }
  }
}
