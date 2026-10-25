import {
  accessDecision,
  accessForDestination,
  hasAnyToolAccess,
  hasToolAccess,
  purchaseScopeGranted,
  isBusinessTool,
  accessPath,
  businessDestination,
  parseAccess,
  parsePurchase,
  purchaseIdPattern,
  recoveryPrefix,
  subscriptionsPath,
  validateReviewedQuote,
  type BusinessToolsAccess,
  type BusinessTool,
  type BusinessToolScope,
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
  refreshing?: boolean;
  refreshError?: string;
  access?: BusinessToolsAccess;
  accountAccess?: BusinessToolsAccess;
  requiredTool?: BusinessTool;
  requiredToolFor?: string;
  error?: string;
  submissionError?: string;
  busy: boolean;
  uncertain: boolean;
  intent?: PurchaseIntent;
  purchase?: BusinessToolsPurchase;
  resourceUnavailable: boolean;
  resourceUnavailableFor?: string;
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
      effectiveAccess(state, destination)?.accessGranted === true &&
      !!businessDestination(destination) &&
      !resourceAccessUnavailable(state, destination))
  );
}
export function effectiveAccess(
  state: BusinessToolsState,
  destination = state.destination || "/overview",
) {
  const required =
    state.requiredTool && state.requiredToolFor?.split("?")[0] === destination.split("?")[0]
      ? state.requiredTool
      : undefined;
  return state.accountAccess
    ? accessForDestination(state.accountAccess, destination, required)
    : state.access;
}
export function resourceAccessUnavailable(state: BusinessToolsState, destination: string) {
  return (
    state.resourceUnavailable &&
    (!state.resourceUnavailableFor ||
      state.resourceUnavailableFor.split("?")[0] === destination.split("?")[0])
  );
}
/** A backend-approved unpaid bank attempt may be replaced only within its original offer. */
export function paymentOffer(state: BusinessToolsState) {
  const access = effectiveAccess(state);
  const purchase = state.purchase;
  if (!purchase) return access;
  if (
    access &&
    purchase.id &&
    purchase.status === "PENDING" &&
    purchase.canChangePaymentMethod === true &&
    (purchase.tool || "BUNDLE") === (access.tool || "BUNDLE")
  )
    return { ...access, pendingPurchase: null };
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
  private accessCheckedAt?: number;
  private statusTask?: Promise<void>;
  private storageKey: string;
  private restored = false;
  private recoveredPurchaseId?: string;
  private pricingReviewRefreshed = false;
  private intentTool: BusinessToolScope = "BUNDLE";
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
      this.dependencies.storage.setItem(
        this.storageKey,
        JSON.stringify({ ...recovery, tool: this.intentTool, destination: this.state.destination }),
      );
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
      this.intentTool = isBusinessTool(recovery?.tool) ? recovery.tool : "BUNDLE";
      const destination =
        typeof recovery?.destination === "string"
          ? businessDestination(recovery.destination)
          : undefined;
      if (!this.state.destination && destination) this.update({ destination });
      if (recovery?.intent) {
        const intent = recovery.intent as PurchaseIntent;
        if (
          !/^[A-Za-z0-9_.:-]{1,128}$/.test(intent.idempotencyKey) ||
          !intent.planCode ||
          !Number.isSafeInteger(intent.paymentMethod?.id) ||
          intent.paymentMethod.id <= 0 ||
          !/^[A-Z]{3}$/.test(intent.paymentMethod.currency) ||
          intent.paymentMethod.feeApplicationMode !== "EXCLUSIVE" ||
          (intent.replacePurchaseId !== undefined &&
            (typeof intent.replacePurchaseId !== "string" ||
              !purchaseIdPattern.test(intent.replacePurchaseId)))
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
  enter(destination: string, denied = false, requiredTool?: BusinessTool) {
    const known = businessDestination(destination);
    if (!known || this.disposed) return Promise.resolve();
    if (this.state.destination !== known) this.update({ destination: known });
    if (denied || requiredTool)
      this.update({ requiredTool, requiredToolFor: requiredTool ? known : undefined });
    this.selectOffer();
    return denied ? this.reload(true) : this.ensureAccess();
  }
  private selectOffer() {
    if (!this.state.accountAccess) return;
    const access = effectiveAccess(this.state);
    this.update({ access });
    // A pending payment belongs to its original offer; never replace it when selecting another card.
    if (
      !access?.accessGranted &&
      access?.pendingPurchase &&
      this.state.purchase?.id !== access.pendingPurchase.id
    ) {
      const replacementIntent =
        this.state.intent?.replacePurchaseId === access.pendingPurchase.id
          ? this.state.intent
          : undefined;
      this.update({
        purchase: {
          ...access.pendingPurchase,
          accessGranted: false,
          access,
          failureCode: null,
          failureMessage: null,
        },
        intent: replacementIntent,
        uncertain: !!replacementIntent,
      });
      this.save(
        replacementIntent
          ? { intent: replacementIntent }
          : { purchaseId: access.pendingPurchase.id },
      );
    }
  }
  /** One account-level result in memory; entering another tool does not invalidate it. */
  ensureAccess(): Promise<void> {
    if (this.disposed || (this.state.access && !this.state.loading && !this.state.error))
      return Promise.resolve();
    return this.reload();
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
  /** Resume checks retain a previously verified grant while the server revalidates it. */
  revalidate(): Promise<void> {
    if (this.disposed || this.state.busy) return Promise.resolve();
    if (this.accessTask) return this.accessTask;
    if (
      this.accessCheckedAt !== undefined &&
      (this.dependencies.now ?? Date.now)() - this.accessCheckedAt < 60_000
    )
      return Promise.resolve();
    return this.reload(false, { background: true });
  }
  reload(denied = false, options: { background?: boolean } = {}): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.accessTask && !denied) return this.accessTask;
    const revision = ++this.revision;
    const background =
      !!options.background &&
      hasAnyToolAccess(this.state.accountAccess || this.state.access) &&
      !this.state.error &&
      !denied;
    this.accessCheckedAt = (this.dependencies.now ?? Date.now)();
    this.update({
      loading: !background,
      refreshing: background,
      refreshError: undefined,
      error: undefined,
      ...(denied
        ? {
            forced: true,
            resourceUnavailable: true,
            resourceUnavailableFor: this.state.destination,
          }
        : {}),
    });
    const savedId = this.restore();
    const task = (async () => {
      try {
        const access = await this.readAccess();
        if (this.disposed || revision !== this.revision) return;
        const previous = this.state.accountAccess || this.state.access;
        const previouslyGranted = effectiveAccess(this.state)?.accessGranted;
        this.update({ accountAccess: access });
        this.selectOffer();
        const selected = this.state.access;
        if (!selected)
          throw new Error(
            "The selected Business Tool offer is unavailable. Refresh access or contact support.",
          );
        this.update({
          access: selected,
          loading: false,
          refreshing: false,
          ...(!selected.accessGranted
            ? { resourceUnavailable: false, resourceUnavailableFor: undefined }
            : {}),
        });
        if (selected.accessGranted) {
          const intentGranted =
            this.intentTool === "BUNDLE"
              ? access.accessGranted
              : hasToolAccess(access, this.intentTool);
          const clear = !this.state.uncertain || intentGranted;
          if (!selected.pendingPurchase && clear) this.save();
          this.update({
            ...(clear ? { intent: undefined, purchase: undefined, uncertain: false } : {}),
            accessIssue: false,
          });
          if (
            !previouslyGranted ||
            JSON.stringify(previous?.tools) !== JSON.stringify(access.tools)
          )
            this.dependencies.onGranted();
        } else if (selected.pendingPurchase) {
          const pending = selected.pendingPurchase;
          const replacementIntent =
            this.state.intent?.replacePurchaseId === pending.id ? this.state.intent : undefined;
          this.update({
            purchase: {
              ...(this.state.purchase?.id === pending.id ? this.state.purchase : {}),
              ...pending,
              access: selected,
              accessGranted: false,
              failureCode: null,
              failureMessage: null,
            },
            uncertain: !!replacementIntent,
            intent: replacementIntent,
            submissionError: undefined,
          });
          this.save(replacementIntent ? { intent: replacementIntent } : { purchaseId: pending.id });
        } else if (savedId && !this.state.purchase) {
          await this.loadPurchase(savedId);
        }
      } catch (error) {
        if (!this.disposed && revision === this.revision) {
          const message =
            error instanceof Error ? error.message : "Couldn’t check Business Tools access.";
          this.update({
            loading: false,
            refreshing: false,
            ...(background ? { refreshError: message } : { error: message }),
          });
        }
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
    const access = paymentOffer(this.state);
    if (
      !access ||
      this.state.loading ||
      this.state.error ||
      accessDecision(access) !== "purchase" ||
      this.state.intent ||
      this.state.resourceUnavailable
    )
      throw new Error("Check your existing access or payment before starting a purchase.");
    validateReviewedQuote(quote, paymentMethod, access, (this.dependencies.now ?? Date.now)());
    const intent: PurchaseIntent = {
      ...(this.state.purchase?.id ? { replacePurchaseId: this.state.purchase.id } : {}),
      planCode: access.plan.code,
      idempotencyKey: `bt_${(this.dependencies.uuid ?? (() => crypto.randomUUID()))()}`,
      paymentMethod: { ...paymentMethod },
    };
    // Persist before POST. A reload must never turn an uncertain payment into a new intent.
    try {
      this.intentTool = access.tool || "BUNDLE";
      this.save({ intent });
    } catch {
      throw new Error(
        "Allow session storage before starting this payment, so it can be safely recovered.",
      );
    }
    this.revision++; // An older status read must not overwrite the confirmed replacement intent.
    this.update({ intent, busy: true, error: undefined, refreshing: false });
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
      if (!this.disposed && revision === this.revision) {
        await this.acceptPurchase(purchase);
        if (intent.replacePurchaseId && this.state.purchase?.status === "PENDING")
          await this.reload();
      }
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
        (status === 400 ||
          status === 422 ||
          (status === 409 &&
            (this.state.access?.plan.code !== intent.planCode || !!intent.replacePurchaseId))) &&
        !this.disposed &&
        !this.state.loading &&
        !this.state.error &&
        !this.state.access?.accessGranted &&
        (!this.state.purchase || this.state.purchase.id === intent.replacePurchaseId)
      ) {
        this.save();
        this.update({
          intent: undefined,
          uncertain: false,
          ...(intent.replacePurchaseId
            ? {
                submissionError:
                  error instanceof Error
                    ? error.message
                    : "This payment method could not be selected.",
              }
            : {}),
        });
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
      if (this.state.purchase && this.state.purchase.id !== this.state.intent?.replacePurchaseId) {
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
    this.intentTool = purchase.tool || "BUNDLE";
    const needsAccess =
      purchase.accessGranted || purchase.access.accessGranted || purchase.status !== "PENDING";
    this.update({
      purchase,
      intent: undefined,
      uncertain: false,
      error: undefined,
      loading: needsAccess,
    });
    if (purchase.id && ["PENDING", "COMPLETED"].includes(purchase.status))
      this.save({ purchaseId: purchase.id });
    else this.save();
    if (purchase.accessGranted || purchase.access.accessGranted || purchase.status !== "PENDING") {
      // Payment status never substitutes for current access, including failed payments with an independent grant.
      const access = await this.readAccess();
      if (this.disposed || revision !== this.revision) return;
      this.update({
        accountAccess: access,
        loading: false,
      });
      this.selectOffer();
      const granted = this.state.access?.accessGranted === true;
      this.update({ accessIssue: !granted && purchase.status === "COMPLETED" });
      if (granted) {
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
      (["FAILED", "CANCELLED", "REFUNDED"].includes(this.state.purchase.status) ||
        (this.state.purchase.status === "COMPLETED" &&
          purchaseScopeGranted(this.state.accountAccess, this.state.purchase)))
    ) {
      this.save();
      this.update({ purchase: undefined, intent: undefined, uncertain: false, error: undefined });
      return this.reload();
    }
  }
  retryResource() {
    this.update({ resourceUnavailable: false, resourceUnavailableFor: undefined });
    return this.reload();
  }
  dismissOffer() {
    this.update({ requiredTool: undefined, requiredToolFor: undefined });
    this.selectOffer();
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
