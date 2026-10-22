"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Coffee,
  Gift,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Badge, Empty, ErrorState, Loading, Modal, PageHeading, Pagination } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { amountInMinorUnits, money } from "@/lib/format";
import { demoMode } from "@/lib/auth";
import type { Order, Page, PosInput, Product, Quote, Store } from "@/lib/types";

export default function Pos() {
  const stores = useQuery<Page<Store>>("/customer-api/commerce/stores?page=0&size=100");
  const [selectedId, setSelectedId] = useState("");
  const { refresh } = useWorkspace();
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("store");
    if (id) setSelectedId(id);
  }, []);
  const activeStores = stores.data?.content.filter((store) => store.status === "ACTIVE") ?? [];
  const selected = activeStores.find((store) => String(store.id) === selectedId) || activeStores[0];
  return (
    <>
      <PageHeading
        eyebrow="POINT OF SALE"
        title="A good day starts with a sale."
        description="Your products and your checkout, working together."
      >
        {selected && (
          <label className="pos-store-select">
            <span className="sr-only">Select POS store</span>
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
              {activeStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} · {store.defaultCurrency}
                </option>
              ))}
            </select>
          </label>
        )}
      </PageHeading>
      {stores.loading ? (
        <Loading />
      ) : stores.error ? (
        <ErrorState message={stores.error} retry={refresh} />
      ) : !selected ? (
        <Empty
          title="Your counter is almost ready"
          description="Create or activate a store, then add products to start making sales."
        >
          <Link href="/stores" className="button primary">
            Go to stores <ArrowRight size={16} />
          </Link>
        </Empty>
      ) : (
        <PosRegister key={selected.id} store={selected} />
      )}
    </>
  );
}
function PosRegister({ store }: { store: Store }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<Quote>();
  const [receipt, setReceipt] = useState<Order>();
  const [buyer, setBuyer] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const products = useQuery<Page<Product>>(
    `/customer-api/commerce/stores/${store.id}/products?page=${page}&size=12`,
  );
  const { refresh, notify } = useWorkspace();
  const currency = store.defaultCurrency;
  const fraction =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const total =
    cart.reduce(
      (sum, item) => sum + amountInMinorUnits(item.product.priceAmount, currency) * item.quantity,
      0,
    ) /
    10 ** fraction;
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const visible =
    products.data?.content.filter((product) =>
      `${product.name} ${product.sku || ""}`.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const icons = [ShoppingBag, Package, Coffee, ShoppingBag, Package, Gift];
  function add(product: Product) {
    if (busy) return;
    const current = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
    if (
      product.inventoryPolicy === "TRACKED" &&
      current >= Number(product.inventoryQuantity ?? 0)
    ) {
      notify("You’ve reached the available stock for this product.");
      return;
    }
    setError("");
    setCart((items) =>
      current
        ? items.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...items, { product, quantity: 1 }],
    );
  }
  function decrement(id: number) {
    setCart((items) =>
      items
        .map((item) => (item.product.id === id ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0),
    );
  }
  function payload(): PosInput {
    return {
      items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })),
      billingCurrency: currency,
      paymentCurrency: currency,
      paymentMode: "CASH",
      paymentStatus: "PAID",
      ...(buyer.trim() ? { buyerName: buyer.trim() } : {}),
    };
  }
  async function review() {
    if (!cart.length || busy) return;
    setBusy(true);
    setError("");
    setConfirmed(false);
    setUncertain(false);
    try {
      setQuote(
        await request<Quote>(`/customer-api/commerce/stores/${store.id}/pos/orders/quote`, {
          method: "POST",
          body: JSON.stringify(payload()),
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t quote the sale.");
    } finally {
      setBusy(false);
    }
  }
  async function complete() {
    if (busy || !confirmed || !quote || uncertain) return;
    if (quote.expiresAt && new Date(quote.expiresAt).getTime() <= Date.now()) {
      setError("This quote has expired. Close and review the sale again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const order = await request<Order>(`/customer-api/commerce/stores/${store.id}/pos/orders`, {
        method: "POST",
        body: JSON.stringify(payload()),
      });
      setReceipt(order);
      setQuote(undefined);
      setCart([]);
      setBuyer("");
      refresh();
      notify("Sale recorded.");
    } catch (error) {
      setUncertain(true);
      setError(
        `${error instanceof Error ? error.message : "Couldn’t confirm the sale."} Check your store’s orders before submitting this sale again.`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pos-layout">
        <section className="panel catalog-panel">
          <div className="panel-heading">
            <h2>Product catalog</h2>
            <Link className="text-button" href={`/stores/${store.id}`}>
              Manage products <ArrowRight size={14} />
            </Link>
          </div>
          <div className="catalog-search">
            <label className="search-input">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products on this page…"
                aria-label="Search POS products"
              />
            </label>
            <span className="quiet-label">{currency} catalog</span>
          </div>
          {products.loading ? (
            <Loading />
          ) : products.error ? (
            <ErrorState message={products.error} retry={refresh} />
          ) : !visible.length ? (
            <Empty
              title="No products here yet"
              description="Add products in your store, or try a different search."
            />
          ) : (
            <div className="product-grid">
              {visible.map((product, index) => {
                const Icon = icons[index % icons.length];
                const available =
                  product.status === "ACTIVE" &&
                  product.priceCurrency === currency &&
                  (product.inventoryPolicy !== "TRACKED" || Number(product.inventoryQuantity) > 0);
                return (
                  <button
                    className="pos-product"
                    key={product.id}
                    disabled={!available || busy}
                    onClick={() => add(product)}
                    aria-label={`Add ${product.name} to sale`}
                  >
                    <span className={`product-illustration product-color-${index % 6}`}>
                      <Icon size={38} strokeWidth={1.25} />
                      <span className="add-product-circle">
                        <Plus size={17} />
                      </span>
                    </span>
                    <strong>{product.name}</strong>
                    <small>{product.sku || "No SKU"}</small>
                    <span className="product-price">
                      {money(product.priceAmount, product.priceCurrency)}
                    </span>
                    {!available && (
                      <span className="unavailable">
                        {product.priceCurrency !== currency
                          ? `Uses ${product.priceCurrency}`
                          : "Unavailable"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {products.data && (
            <Pagination
              page={page}
              pages={products.data.totalPages}
              total={products.data.totalElements}
              onChange={(value) => {
                setPage(value);
                setSearch("");
              }}
            />
          )}
        </section>
        <aside className="panel cart-panel">
          <div className="panel-heading">
            <h2>
              Current sale <span className="count-pill">{quantity}</span>
            </h2>
            <button
              className="icon-button"
              aria-label="Clear sale"
              disabled={!cart.length || busy}
              onClick={() => setCart([])}
            >
              <Trash2 size={17} />
            </button>
          </div>
          {!cart.length ? (
            <div className="cart-empty">
              <ShoppingCart size={36} strokeWidth={1.3} />
              <h3>A little empty, for now.</h3>
              <p>Tap a product to add it to your sale.</p>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map(({ product, quantity }) => (
                <div className="cart-item" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <small>{money(product.priceAmount, currency)} each</small>
                  </div>
                  <div className="quantity-control">
                    <button
                      disabled={busy}
                      onClick={() => decrement(product.id)}
                      aria-label={`Remove one ${product.name}`}
                    >
                      <Minus size={13} />
                    </button>
                    <span>{quantity}</span>
                    <button
                      disabled={busy}
                      onClick={() => add(product)}
                      aria-label={`Add one ${product.name}`}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="cart-bottom">
            <label>
              Customer name <span className="optional">(optional)</span>
              <input
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                maxLength={180}
                placeholder="Walk-in customer"
                disabled={busy}
              />
            </label>
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <strong>{money(total, currency)}</strong>
            </div>
            <p className="cart-fee-note">Any applicable fees are shown before you confirm.</p>
            {error && !quote && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary checkout-button"
              onClick={() => void review()}
              disabled={!cart.length || busy}
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  Quoting…
                </>
              ) : (
                <>
                  Review cash sale <ArrowRight size={17} />
                </>
              )}
            </button>
            <small className="cart-caption">
              {demoMode
                ? "Demo checkout · no real payment"
                : "Record cash received at your counter"}
            </small>
          </div>
        </aside>
      </div>
      {quote && (
        <Modal
          title="Confirm cash sale"
          description={store.name}
          onClose={() => {
            setQuote(undefined);
            setError("");
          }}
          busy={busy}
        >
          <div className="transaction-hero">
            <strong>{money(quote.totalAmount, quote.totalCurrency)}</strong>
            <span className="quiet-label">CASH PAYMENT</span>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Items</dt>
              <dd>{quantity}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{buyer.trim() || "Walk-in customer"}</dd>
            </div>
            <div>
              <dt>Applicable fees</dt>
              <dd>{money(quote.feeAmount, quote.feeCurrency || quote.totalCurrency)}</dd>
            </div>
          </dl>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm I have received {money(quote.totalAmount, quote.totalCurrency)} in cash.
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setQuote(undefined);
                setError("");
              }}
            >
              Back to sale
            </button>
            <button
              className="button primary"
              disabled={!confirmed || busy || uncertain}
              onClick={() => void complete()}
            >
              {busy ? "Recording…" : "Record sale"}
            </button>
          </div>
        </Modal>
      )}
      {receipt && (
        <Modal
          title="Another sale, nicely done."
          description="Your sale has been recorded."
          onClose={() => setReceipt(undefined)}
        >
          <div className="receipt-check">
            <Check size={30} />
          </div>
          <div className="transaction-hero">
            <strong>{money(receipt.totalAmount, receipt.totalCurrency)}</strong>
            <Badge value={receipt.posPaymentStatus || receipt.status} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Reference</dt>
              <dd>{receipt.reference}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{receipt.buyerName || "Walk-in customer"}</dd>
            </div>
          </dl>
          <div className="modal-actions">
            <Link className="button secondary" href={`/stores/${store.id}`}>
              View store
            </Link>
            <button className="button primary" onClick={() => setReceipt(undefined)}>
              Start a new sale
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
