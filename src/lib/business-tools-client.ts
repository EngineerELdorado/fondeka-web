import {
  accessDecision,
  accessPath,
  businessDestination,
  parseAccess,
  parsePurchase,
  purchaseIdPattern,
  recoveryPrefix,
  subscriptionsPath,
  validateReviewedQuote,
  type BusinessToolsAccess,
  type BusinessToolsPurchase,
  type PaymentSelection,
  type PurchaseIntent,
  type ReviewedQuote,
} from "./business-tools";

type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
export interface BusinessToolsState {
  destination?: string;
  loading: boolean;
  access?: BusinessToolsAccess;
  error?: string;
  submissionError?: string;
  busy: boolean;
  uncertain: boolean;
  intent?: PurchaseIntent;
  purchase?: BusinessToolsPurchase;
  resourceUnavailable: boolean;
  accessIssue: boolean;
  forced: boolean;
}
export function mayMountOwnerData(
  state: BusinessToolsState,
  destination: string,
  enabled: boolean,
) {
  return (
    !enabled ||
    (!state.loading &&
      !state.error &&
      state.access?.accessGranted === true &&
      !state.resourceUnavailable &&
      state.destination?.split("?")[0] === destination)
  );
}
export class BusinessToolsClient {
  private state: BusinessToolsState = {
    loading: true,
    busy: false,
    uncertain: false,
    resourceUnavailable: false,
    accessIssue: false,
    forced: false,
  };
  private listeners = new Set<() => void>();
  private revision = 0;
  private disposed = false;
  private accessTask?: Promise<void>;
  private statusTask?: Promise<void>;
  private storageKey: string;
  private restored = false;
  private recoveredPurchaseId?: string;
  private pricingReviewRefreshed = false;
  constructor(
    private dependencies: {
      accountKey: string;
      request: Transport;
      storage: Storage;
      onGranted: () => void;
      now?: () => number;
      uuid?: () => string;
    },
  ) {
    this.storageKey = recoveryPrefix + dependencies.accountKey;
  }
  getSnapshot = () => this.state;
  subscribe = (callback: () => void) => {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  };
  private update(next: Partial<BusinessToolsState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((callback) => callback());
  }
  dispose() {
    this.disposed = true;
    this.revision++;
    this.listeners.clear();
  }
  private save(recovery?: { intent?: PurchaseIntent; purchaseId?: string }) {
    if (recovery) {
      this.dependencies.storage.setItem(this.storageKey, JSON.stringify(recovery));
      this.recoveredPurchaseId = recovery.purchaseId;
    } else {
      this.recoveredPurchaseId = undefined;
      try {
        this.dependencies.storage.removeItem(this.storageKey);
      } catch {
        /* No financial request depends on clearing storage. */
      }
    }
  }
  private restore() {
    if (this.restored) return this.recoveredPurchaseId;
    this.restored = true;
    try {
      const recovery = JSON.parse(this.dependencies.storage.getItem(this.storageKey) || "null");
      if (recovery?.intent) {
        const intent = recovery.intent as PurchaseIntent;
        if (
          !/^[A-Za-z0-9_.:-]{1,128}$/.test(intent.idempotencyKey) ||
          !intent.planCode ||
          !Number.isSafeInteger(intent.paymentMethod?.id) ||
          intent.paymentMethod.id <= 0 ||
          !/^[A-Z]{3}$/.test(intent.paymentMethod.currency) ||
          intent.paymentMethod.feeApplicationMode !== "EXCLUSIVE"
        )
          throw new Error("Invalid saved payment");
        this.update({ intent, uncertain: true });
      }
      this.recoveredPurchaseId =
        typeof recovery?.purchaseId === "string" && purchaseIdPattern.test(recovery.purchaseId)
          ? recovery.purchaseId
          : undefined;
      return this.recoveredPurchaseId;
    } catch {
      this.save();
    }
  }
  enter(destination: string, denied = false) {
    const known = businessDestination(destination);
    if (!known) return Promise.resolve();
    this.update({ destination: known });
    return this.reload(denied);
  }
  private async readAccess() {
    let access = parseAccess(await this.dependencies.request(accessPath));
    if (
      !this.disposed &&
      !this.pricingReviewRefreshed &&
      !access.accessGranted &&
      !access.pendingPurchase &&
      access.plan.purchasesEnabled &&
      access.plan.amount > 0 &&
      (access.pricing.amountDue === 0 || access.pricing.legacyCreditAmount > 0)
    ) {
      this.pricingReviewRefreshed = true;
      access = parseAccess(await this.dependencies.request(accessPath));
    }
    return access;
  }
  reload(denied = false): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.accessTask && !denied) return this.accessTask;
    const revision = ++this.revision;
    this.update({
      loading: true,
      error: undefined,
      ...(denied ? { forced: true, resourceUnavailable: true } : {}),
    });
    const savedId = this.restore();
    const task = (async () => {
      try {
        const access = await this.readAccess();
        if (this.disposed || revision !== this.revision) return;
        const previouslyGranted = this.state.access?.accessGranted;
        this.update({
          access,
          loading: false,
          ...(!access.accessGranted ? { resourceUnavailable: false } : {}),
        });
        if (access.accessGranted) {
          this.save();
          this.update({
            intent: undefined,
            purchase: undefined,
            uncertain: false,
            accessIssue: false,
          });
          if (!previouslyGranted) this.dependencies.onGranted();
        } else if (access.pendingPurchase) {
          const pending = access.pendingPurchase;
          this.update({
            purchase: {
              ...pending,
              access,
              accessGranted: false,
              failureCode: null,
              failureMessage: null,
            },
            uncertain: false,
            intent: undefined,
            submissionError: undefined,
          });
          this.save({ purchaseId: pending.id });
        } else if (savedId && !this.state.purchase) {
          await this.loadPurchase(savedId);
        }
      } catch (error) {
        if (!this.disposed && revision === this.revision)
          this.update({
            loading: false,
            error: error instanceof Error ? error.message : "Couldn’t check Business Tools access.",
          });
      }
    })();
    this.accessTask = task;
    void task.finally(() => {
      if (this.accessTask === task) this.accessTask = undefined;
    });
    return task;
  }
  async purchase(paymentMethod: PaymentSelection, quote: ReviewedQuote) {
    if (this.state.busy || this.disposed) return;
    const access = this.state.access;
    if (
      !access ||
      this.state.loading ||
      this.state.error ||
      accessDecision(access) !== "purchase" ||
      this.state.intent ||
      this.state.purchase ||
      this.state.resourceUnavailable
    )
      throw new Error("Check your existing access or payment before starting a purchase.");
    validateReviewedQuote(quote, paymentMethod, access, (this.dependencies.now ?? Date.now)());
    const intent: PurchaseIntent = {
      planCode: access.plan.code,
      idempotencyKey: `bt_${(this.dependencies.uuid ?? (() => crypto.randomUUID()))()}`,
      paymentMethod: { ...paymentMethod },
    };
    // Persist before POST. A reload must never turn an uncertain payment into a new intent.
    try {
      this.save({ intent });
    } catch {
      throw new Error(
        "Allow session storage before starting this payment, so it can be safely recovered.",
      );
    }
    this.update({ intent, busy: true, error: undefined });
    await this.post(intent);
  }
  private async post(intent: PurchaseIntent) {
    const revision = this.revision;
    this.update({ submissionError: undefined });
    try {
      const purchase = parsePurchase(
        await this.dependencies.request(subscriptionsPath, {
          method: "POST",
          body: JSON.stringify(intent),
        }),
      );
      if (!this.disposed && revision === this.revision) await this.acceptPurchase(purchase);
    } catch (error) {
      if (this.disposed) return;
      this.update({
        uncertain: true,
        submissionError: error instanceof Error ? error.message : "Payment result is uncertain.",
      });
      await this.reload(); // A read only: never retry the POST automatically.
      // A validation rejection did not accept a purchase. Confirm access/pending state
      // before allowing the customer to correct their selection with a fresh intent.
      const status = (error as { status?: number } | null)?.status;
      if (
        (status === 400 || status === 422) &&
        !this.disposed &&
        !this.state.loading &&
        !this.state.error &&
        !this.state.access?.accessGranted &&
        !this.state.purchase
      ) {
        this.save();
        this.update({ intent: undefined, uncertain: false });
      }
    } finally {
      this.update({ busy: false });
    }
  }
  async retryIntent() {
    if (this.state.busy || this.disposed) return;
    this.update({ busy: true });
    try {
      await this.reload();
      if (
        this.disposed ||
        this.state.error ||
        this.state.loading ||
        this.state.access?.accessGranted
      )
        return;
      if (this.state.purchase) {
        await this.checkStatus();
        return;
      }
      if (this.state.intent) await this.post(this.state.intent);
    } finally {
      this.update({ busy: false });
    }
  }
  private async acceptPurchase(purchase: BusinessToolsPurchase) {
    if (this.disposed) return;
    const revision = this.revision;
    const needsAccess =
      purchase.accessGranted || purchase.access.accessGranted || purchase.status !== "PENDING";
    this.update({
      purchase,
      intent: undefined,
      uncertain: false,
      error: undefined,
      access: purchase.access,
      loading: needsAccess,
    });
    if (purchase.id && purchase.status === "PENDING") this.save({ purchaseId: purchase.id });
    else if (
      purchase.status === "COMPLETED" &&
      !purchase.accessGranted &&
      !purchase.access.accessGranted
    ) {
      if (purchase.id) this.save({ purchaseId: purchase.id });
    } else this.save();
    if (purchase.accessGranted || purchase.access.accessGranted || purchase.status !== "PENDING") {
      // Payment status never substitutes for current access, including failed payments with an independent grant.
      const access = await this.readAccess();
      if (this.disposed || revision !== this.revision) return;
      this.update({
        access,
        loading: false,
        accessIssue: !access.accessGranted && purchase.status === "COMPLETED",
      });
      if (access.accessGranted) {
        this.save();
        this.update({ intent: undefined, purchase: undefined, uncertain: false });
        this.dependencies.onGranted();
      }
    }
  }
  private async loadPurchase(id: string) {
    const revision = this.revision;
    const purchase = parsePurchase(await this.dependencies.request(`${subscriptionsPath}/${id}`));
    if (this.disposed || revision !== this.revision) return;
    await this.acceptPurchase(purchase);
  }
  checkStatus(): Promise<void> {
    if (this.statusTask) return this.statusTask;
    const id = this.state.purchase?.id;
    if (!id || !purchaseIdPattern.test(id) || this.disposed) return this.reload();
    const revision = this.revision;
    const task = (async () => {
      try {
        await this.loadPurchase(id);
      } catch (error) {
        if (revision === this.revision)
          this.update({
            loading: false,
            error: error instanceof Error ? error.message : "Couldn’t check payment status.",
          });
      }
    })();
    this.statusTask = task;
    void task.finally(() => {
      if (this.statusTask === task) this.statusTask = undefined;
    });
    return task;
  }
  startAgain() {
    if (this.state.error || this.state.loading || this.state.busy) return;
    if (
      !this.state.access?.accessGranted &&
      this.state.purchase &&
      ["FAILED", "CANCELLED", "REFUNDED"].includes(this.state.purchase.status)
    ) {
      this.save();
      this.update({ purchase: undefined, intent: undefined, uncertain: false, error: undefined });
      return this.reload();
    }
  }
  retryResource() {
    this.update({ resourceUnavailable: false });
    return this.reload();
  }
}

export function clearBusinessToolsRecovery(storage?: globalThis.Storage, keepAccount?: string) {
  try {
    const target = storage ?? window.sessionStorage;
    for (const key of Object.keys(target))
      if (key.startsWith(recoveryPrefix) && key !== recoveryPrefix + keepAccount)
        target.removeItem(key);
  } catch {
    /* Login/logout must remain available when browser storage is disabled. */
  }
}
