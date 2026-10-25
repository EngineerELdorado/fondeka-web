import { apiCatalogPath, parseApiCatalog, type ApiCatalog } from "./api-catalog";

export type CatalogReadScope = {
  accountKey: string;
  businessId: number;
  currency: string;
  language: "en" | "fr";
};
export const catalogReadKey = (scope: CatalogReadScope) =>
  JSON.stringify([
    scope.accountKey,
    apiCatalogPath(scope.businessId, scope.currency),
    scope.language,
  ]);
type Snapshot = { key: string; loading: boolean; data?: ApiCatalog; error?: string };
type Read = (path: string, init: RequestInit) => Promise<unknown>;

/** Private to one open catalog. View filters never change this read's scope. */
export class ApiCatalogReader {
  private state: Snapshot = { key: "", loading: false };
  private listeners = new Set<() => void>();
  private scope?: CatalogReadScope;
  private pending?: { controller: AbortController; key: string; task: Promise<void> };
  constructor(private read: Read) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: Snapshot) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  load(scope: CatalogReadScope, force = false): Promise<void> {
    scope = { ...scope, currency: scope.currency.trim().toUpperCase() };
    const key = catalogReadKey(scope);
    if (this.pending?.key === key) return this.pending.task;
    if (!force && this.state.key === key && this.state.data) return Promise.resolve();
    this.pending?.controller.abort();
    this.scope = { ...scope };
    const controller = new AbortController();
    const pending = { controller, key, task: Promise.resolve() };
    this.pending = pending;
    this.publish({ key, loading: true });
    pending.task = Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      try {
        const value = await this.read(apiCatalogPath(scope.businessId, scope.currency), {
          signal: controller.signal,
          cache: "no-store",
          headers: { "Accept-Language": scope.language },
        });
        if (this.pending !== pending || controller.signal.aborted) return;
        const data = parseApiCatalog(value, scope.currency);
        this.publish({ key, loading: false, data });
      } catch (error) {
        if (this.pending !== pending || controller.signal.aborted) return;
        this.publish({
          key,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : scope.language === "fr"
                ? "Impossible de charger les moyens de paiement."
                : "Couldn’t load payment methods.",
        });
      } finally {
        if (this.pending === pending) this.pending = undefined;
      }
    });
    return pending.task;
  }
  refresh = () => (this.scope ? this.load(this.scope, true) : Promise.resolve());
  clear = () => {
    this.pending?.controller.abort();
    this.pending = undefined;
    this.scope = undefined;
    this.publish({ key: "", loading: false });
  };
}

/** Native controls can emit window focus. Only a real hidden → visible transition reloads. */
export function refreshCatalogOnReturn(
  document: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">,
  refresh: () => void,
) {
  let hidden = document.visibilityState === "hidden";
  const changed = () => {
    if (document.visibilityState === "hidden") hidden = true;
    else if (document.visibilityState === "visible" && hidden) {
      hidden = false;
      refresh();
    }
  };
  document.addEventListener("visibilitychange", changed);
  return () => document.removeEventListener("visibilitychange", changed);
}
