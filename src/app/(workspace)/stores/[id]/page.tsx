"use client";

import Link from "next/link";
import { use, useState, type FormEvent } from "react";
import { ArrowLeft, ExternalLink, Monitor, Package, Pencil, Plus } from "lucide-react";
import {
  Badge,
  MobileRecord,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  SubmitButton,
} from "@/components/ui";
import { StoreForm } from "@/components/store-form";
import { useWorkspace } from "@/components/workspace-provider";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { date, label, money, parseAmount, safeLink } from "@/lib/format";
import type { Order, Page, Product, Store } from "@/lib/types";

export default function StoreDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const store = useQuery<Store>(/^\d+$/.test(id) ? `/customer-api/commerce/stores/${id}` : null);
  const [tab, setTab] = useState("products");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const products = useQuery<Page<Product>>(
    tab === "products" && /^\d+$/.test(id)
      ? `/customer-api/commerce/stores/${id}/products?page=${page}&size=10`
      : null,
  );
  const orders = useQuery<Page<Order>>(
    tab === "orders" && /^\d+$/.test(id)
      ? `/customer-api/commerce/stores/${id}/orders?page=${page}&size=10`
      : null,
  );
  const { refresh } = useWorkspace();
  const link = safeLink(store.data?.storefrontUrl || store.data?.publicUrl);
  if (!/^\d+$/.test(id))
    return (
      <Empty title="Store not found" description="Choose a store from your workspace.">
        <Link className="button primary" href="/stores">
          Back to stores
        </Link>
      </Empty>
    );
  return (
    <>
      <Link className="back-link" href="/stores">
        <ArrowLeft size={15} />
        All stores
      </Link>
      {store.loading ? (
        <Loading />
      ) : store.error ? (
        <ErrorState message={store.error} retry={refresh} />
      ) : (
        store.data && (
          <>
            <PageHeading
              eyebrow="YOUR STORE"
              title={store.data.name}
              description={store.data.description || "Your products, your orders, your business."}
            >
              <button
                className="button secondary"
                aria-label="Edit store"
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} />
                Edit store
              </button>
              <Link
                className="button primary"
                aria-label="Open point of sale"
                href={`/pos?store=${id}`}
              >
                <Monitor size={17} />
                Open point of sale
              </Link>
            </PageHeading>
            <div className="store-detail-summary">
              <Badge value={store.data.status} />
              <span>
                Currency <strong>{store.data.defaultCurrency}</strong>
              </span>
              <span>
                Country <strong>{store.data.countryCode || "—"}</strong>
              </span>
              {link && (
                <a className="text-button" href={link} target="_blank" rel="noopener noreferrer">
                  Visit storefront <ExternalLink size={14} />
                </a>
              )}
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div className="tabs" role="tablist" aria-label="Store sections">
                  {["products", "orders"].map((item) => (
                    <button
                      key={item}
                      role="tab"
                      aria-selected={tab === item}
                      className={tab === item ? "active" : ""}
                      onClick={() => {
                        setTab(item);
                        setPage(0);
                      }}
                    >
                      {item === "products" ? "Products" : "Orders"}
                    </button>
                  ))}
                </div>
                {tab === "products" && (
                  <button className="button primary small" onClick={() => setAdding(true)}>
                    <Plus size={15} />
                    Add product
                  </button>
                )}
              </div>
              {tab === "products" ? (
                products.loading ? (
                  <Loading />
                ) : products.error ? (
                  <ErrorState message={products.error} retry={refresh} />
                ) : !products.data?.content.length ? (
                  <Empty
                    title="Make room for your products"
                    description="Add your first product to start selling online and at the counter."
                  >
                    <button className="button primary" onClick={() => setAdding(true)}>
                      <Plus size={16} />
                      Add product
                    </button>
                  </Empty>
                ) : (
                  <>
                    <div className="table-wrap desktop-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Price</th>
                            <th>Inventory</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.data.content.map((product) => (
                            <tr key={product.id}>
                              <td>
                                <span className="product-table-name">
                                  <span className="product-thumb">
                                    <Package size={19} />
                                  </span>
                                  <strong>{product.name}</strong>
                                </span>
                              </td>
                              <td>{product.sku || "—"}</td>
                              <td className="amount">
                                {money(product.priceAmount, product.priceCurrency)}
                              </td>
                              <td>
                                {product.inventoryPolicy === "TRACKED"
                                  ? `${product.inventoryQuantity ?? 0} in stock`
                                  : "Unlimited"}
                              </td>
                              <td>
                                <Badge value={product.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mobile-record-list">
                      {products.data.content.map((product) => (
                        <MobileRecord
                          key={product.id}
                          title={product.name}
                          subtitle={
                            product.inventoryPolicy === "TRACKED"
                              ? `${product.inventoryQuantity ?? 0} in stock`
                              : "Unlimited inventory"
                          }
                          amount={money(product.priceAmount, product.priceCurrency)}
                          status={product.status !== "ACTIVE" ? product.status : undefined}
                          icon={<Package size={20} />}
                        />
                      ))}
                    </div>
                  </>
                )
              ) : orders.loading ? (
                <Loading />
              ) : orders.error ? (
                <ErrorState message={orders.error} retry={refresh} />
              ) : !orders.data?.content.length ? (
                <Empty
                  title="Your first sale is waiting"
                  description="Orders from your store and point of sale will appear here."
                />
              ) : (
                <>
                  <div className="table-wrap desktop-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Reference</th>
                          <th>Customer</th>
                          <th>Channel</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.data.content.map((order) => (
                          <tr key={order.id}>
                            <td className="table-name">{order.reference}</td>
                            <td>{order.buyerName || "Walk-in customer"}</td>
                            <td>{order.channel}</td>
                            <td className="amount">
                              {money(order.totalAmount, order.totalCurrency)}
                            </td>
                            <td>{date(order.createdAt)}</td>
                            <td>
                              <Badge value={order.posPaymentStatus || order.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mobile-record-list">
                    {orders.data.content.map((order) => (
                      <MobileRecord
                        key={order.id}
                        title={order.buyerName || "Walk-in customer"}
                        subtitle={order.reference}
                        meta={`${date(order.createdAt)} · ${order.channel === "POS" ? "Point of sale" : label(order.channel)}`}
                        amount={money(order.totalAmount, order.totalCurrency)}
                        status={order.posPaymentStatus || order.status}
                      />
                    ))}
                  </div>
                </>
              )}
              {(tab === "products" ? products.data : orders.data) && (
                <Pagination
                  page={page}
                  pages={(tab === "products" ? products.data : orders.data)!.totalPages}
                  total={(tab === "products" ? products.data : orders.data)!.totalElements}
                  onChange={setPage}
                />
              )}
            </section>
            {editing && <StoreForm store={store.data} onClose={() => setEditing(false)} />}{" "}
            {adding && <ProductForm store={store.data} onClose={() => setAdding(false)} />}
          </>
        )
      )}
    </>
  );
}
function ProductForm({ store, onClose }: { store: Store; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refresh, notify } = useWorkspace();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const priceAmount = parseAmount(String(form.get("amount")), store.defaultCurrency);
      await request(`/customer-api/commerce/stores/${store.id}/products`, {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name")).trim(),
          sku: String(form.get("sku")).trim(),
          priceAmount,
          priceCurrency: store.defaultCurrency,
          type: "PHYSICAL",
          status: "ACTIVE",
          inventoryPolicy: "UNLIMITED",
          storefrontEnabled: true,
        }),
      });
      refresh();
      notify("Product added to your catalog.");
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t add your product.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Add a product"
      description={`A new addition to ${store.name}.`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Product name
          <input name="name" required maxLength={180} autoFocus placeholder="e.g. Canvas tote" />
        </label>
        <div className="form-grid">
          <label>
            Price ({store.defaultCurrency})
            <input name="amount" required inputMode="decimal" placeholder="0.00" />
          </label>
          <label>
            SKU
            <input name="sku" maxLength={120} placeholder="Optional" />
          </label>
        </div>
        <div className="info-box">
          This product will be active with unlimited inventory and available on your storefront.
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <SubmitButton busy={busy}>Add product</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
