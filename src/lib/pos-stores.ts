import type { Page, Store } from "./types";
import { queryRevision, subscribeQueries } from "./query-cache";
import { normalizePageResponse } from "./page-response";

const storesPath = "/customer-api/commerce/stores";
export const posStoresPath = (page = 0) => `${storesPath}?page=${page}&size=20`;
export const validStoreId = (id: unknown): id is number =>
  typeof id === "number" && Number.isSafeInteger(id) && id > 0;

/** Normalize at the boundary. A broken or incomplete response must never look like zero stores. */
export function normalizePosStores(value: unknown, page = 0): Page<Store> {
  value = normalizePageResponse(value);
  const raw = value as Partial<Page<Store>> | null;
  const content = Array.isArray(value) ? value : raw?.content;
  const total = Array.isArray(value) ? value.length : raw?.totalElements;
  if (
    !Array.isArray(content) ||
    !Number.isSafeInteger(total) ||
    total! < content.length ||
    total! < 0 ||
    (total! > 0 && !content.length) ||
    content.some((store) => !store || !validStoreId(store.id) || typeof store.name !== "string") ||
    (total === 1 && content.length !== 1)
  )
    throw new Error("Unable to load your stores. Please try again.");
  const pages = Array.isArray(value) ? (total ? 1 : 0) : raw?.totalPages;
  if (pages !== undefined && (!Number.isSafeInteger(pages) || pages < (total ? 1 : 0)))
    throw new Error("Unable to load your stores. Please try again.");
  return {
    content,
    totalElements: total!,
    totalPages: pages ?? Math.ceil(total! / 20),
    number: page,
    size: Array.isArray(value) ? Math.max(1, content.length) : 20,
  };
}

export function posDestination(stores: Page<Store>) {
  if (stores.totalElements === 1 && !validStoreId(stores.content[0]?.id))
    throw new Error("Unable to load your stores. Please try again.");
  if (stores.totalElements === 1) return `/stores/${stores.content[0].id}/pos`;
  return stores.totalElements === 0 ? "/stores?mode=pos&state=empty" : "/stores?mode=pos";
}

/** Check both sides of the read so revocation or a superseding click cannot open an owner page. */
export async function resolvePosDestination(
  stores: PosStoresClient,
  language: string,
  allowed: () => boolean | Promise<boolean>,
) {
  if (!(await allowed())) return;
  const cached = stores.cached(0, language);
  const result = cached ?? (await stores.load(0, language));
  if (cached) void stores.load(0, language).catch(() => {});
  if (!(await allowed())) return;
  return posDestination(result);
}

type Entry = { data?: Page<Store>; loading: boolean; error?: Error; time: number };
const empty: Entry = { loading: false, time: 0 };
type Transport = (path: string, init: RequestInit) => Promise<unknown>;

/** One memory-only instance per authenticated account; preload and clicks share in-flight reads. */
export class PosStoresClient {
  private entries = new Map<string, Entry>();
  private pending = new Map<
    string,
    { promise: Promise<Page<Store>>; controller: AbortController }
  >();
  private listeners = new Set<() => void>();
  private revision = 0;
  private disposed = false;
  private stopInvalidation: () => void;
  constructor(
    private transport: Transport,
    private now = Date.now,
  ) {
    let revision = queryRevision(posStoresPath());
    this.stopInvalidation = subscribeQueries(() => {
      const next = queryRevision(posStoresPath());
      if (next !== revision) {
        revision = next;
        this.invalidate();
      }
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  private emit() {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
  page(page = 0, language = "en") {
    return this.entries.get(`${language}:${page}`) ?? empty;
  }
  fresh(page = 0, language = "en") {
    const entry = this.page(page, language);
    return !!entry.data && this.now() - entry.time < 120_000;
  }
  cached(page = 0, language = "en") {
    const entry = this.page(page, language);
    // Explicit create/delete invalidation must resolve the count again before routing.
    return Number.isFinite(entry.time) ? entry.data : undefined;
  }
  load(page = 0, language = "en"): Promise<Page<Store>> {
    if (this.disposed) return Promise.reject(new DOMException("Account changed", "AbortError"));
    const key = `${language}:${page}`;
    const pending = this.pending.get(key);
    if (pending) return pending.promise;
    if (this.fresh(page, language)) return Promise.resolve(this.page(page, language).data!);
    const controller = new AbortController();
    const promise = Promise.resolve().then(async () => {
      try {
        const response = await this.transport(posStoresPath(page), {
          signal: controller.signal,
          headers: { "Accept-Language": language },
        });
        if (controller.signal.aborted || this.disposed)
          throw new DOMException("Cancelled", "AbortError");
        const data = normalizePosStores(response, page);
        this.entries.set(key, { data, time: this.now(), loading: false });
        return data;
      } catch (error) {
        if (!controller.signal.aborted && !this.disposed)
          this.entries.set(key, {
            ...this.page(page, language),
            loading: false,
            error:
              error instanceof Error
                ? error
                : new Error("Unable to load your stores. Please try again."),
          });
        throw error;
      } finally {
        if (this.pending.get(key)?.controller === controller) {
          this.pending.delete(key);
          this.emit();
        }
      }
    });
    this.pending.set(key, { promise, controller });
    this.entries.set(key, { ...this.page(page, language), loading: true, error: undefined });
    this.emit();
    return promise;
  }
  invalidate() {
    for (const { controller } of this.pending.values()) controller.abort();
    this.pending.clear();
    for (const [key, entry] of this.entries)
      this.entries.set(key, { data: entry.data, time: -Infinity, loading: false });
    this.emit();
  }
  dispose() {
    this.disposed = true;
    this.stopInvalidation();
    for (const { controller } of this.pending.values()) controller.abort();
    this.pending.clear();
    this.entries.clear();
    this.listeners.clear();
  }
}
