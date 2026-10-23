"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { canUseStore, isStoreOwner, storeTabAllowed, storeUpdateInput } from "@/lib/commerce";
import { money, label } from "@/lib/format";
import type { Store, Product, Page } from "@/lib/types";
import { Badge, PageHeading, Loading, Empty, ErrorState, Pagination } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { StoreForm } from "@/components/store-form";
import { ProductForm } from "@/components/product-form";
import { CustomersPanel, StaffPanel } from "@/components/store-people";
import { ReportsPanel, SalesPanel } from "@/components/store-sales";
import { LinkSharing } from "@/components/link-sharing";
export default function StoreDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { values, update, page } = useUrlState();
  const { refresh, notify } = useWorkspace();
  const router = useRouter();
  const store = useQuery<Store>(/^\d+$/.test(id) ? `/customer-api/commerce/stores/${id}` : null);
  const [editing, setEditing] = useState(false);
  const adding = values.get("newProduct") === "1";
  const setAdding = (value: boolean) =>
    update({ newProduct: value ? 1 : null, step: null, flow: null });
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const s = store.data;
  const tabs = [
    ["products", t("Products", "Produits")],
    ["sales", t("Sales", "Ventes")],
    ["customers", t("Customers", "Clients")],
    ["reports", t("Reports", "Rapports")],
    ["staff", t("Team", "Équipe")],
    ["settings", t("Settings", "Paramètres")],
  ];
  const permitted = s ? tabs.filter(([tab]) => storeTabAllowed(s, tab)) : [];
  const requested = values.get("tab");
  const tab = requested || permitted[0]?.[0] || "";
  const authorized = !!s && storeTabAllowed(s, tab);
  const products = useQuery<Page<Product>>(
    s && authorized && tab === "products"
      ? `/customer-api/commerce/stores/${id}/products?page=${page}&size=20`
      : null,
  );
  const productId = values.get("product");
  const product = useQuery<Product>(
    s && canUseStore(s, "PRODUCTS") && productId && /^\d+$/.test(productId)
      ? `/customer-api/commerce/products/${productId}`
      : null,
  );
  async function mutate(mode: "delete" | "publish") {
    if (!s || busy) return;
    setBusy(true);
    setError("");
    try {
      const current =
        mode === "publish" ? await request<Store>("/customer-api/commerce/stores/" + id) : s;
      await request(
        `/customer-api/commerce/stores/${id}`,
        mode === "delete"
          ? { method: "DELETE" }
          : {
              method: "PATCH",
              body: JSON.stringify(
                storeUpdateInput(current, { status: "ACTIVE", visibility: "PUBLIC" }),
              ),
            },
      );
      invalidateQueryPaths([
        "/customer-api/commerce/stores?",
        "/customer-api/commerce/stores/" + id,
      ]);
      notify(
        t(
          mode === "delete" ? "Store deleted." : "Store published.",
          mode === "delete" ? "Boutique supprimée." : "Boutique publiée.",
        ),
      );
      if (mode === "delete") router.push("/stores");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to update store.", "Impossible de modifier la boutique."),
      );
    } finally {
      setBusy(false);
    }
  }
  if (adding && s && canUseStore(s, "PRODUCTS"))
    return (
      <ProductForm
        store={s}
        onClose={() => setAdding(false)}
        onSaved={(p) => update({ product: p.id })}
      />
    );
  return (
    <>
      <Link href="/stores" className="back-link">
        ← {t("Online Stores", "Boutiques en ligne")}
      </Link>
      {store.loading ? (
        <Loading />
      ) : store.error ? (
        <ErrorState message={store.error} retry={refresh} />
      ) : (
        s && (
          <>
            <PageHeading
              title={s.name}
              description={s.description || t("Manage your store", "Gérer votre boutique")}
            >
              <button className="button secondary" onClick={refresh}>
                {t("Refresh", "Actualiser")}
              </button>
              {isStoreOwner(s) && (
                <button className="button secondary" onClick={() => setEditing(true)}>
                  {t("Edit store", "Modifier la boutique")}
                </button>
              )}
              {canUseStore(s, "POS") && (
                <Link href={`/stores/${s.id}/pos`} className="button primary">
                  {t("Open POS", "Ouvrir le POS")}
                </Link>
              )}
            </PageHeading>
            <div className="store-detail-summary">
              <Badge value={s.status} />
              <Badge value={s.visibility} />
              <span>
                {label(s.accessType)}
                {s.ownerAccountId
                  ? ` · ${t("Owner account", "Compte propriétaire")} #${s.ownerAccountId}`
                  : ""}
              </span>
              <strong>{s.defaultCurrency}</strong>
            </div>
            <details className="store-share">
              <summary>{t("Store link and QR code", "Lien et code QR de la boutique")}</summary>
              <LinkSharing url={s.storefrontUrl || s.publicUrl} title={s.name} />
            </details>
            <section className="panel">
              <nav
                className="owner-tabs"
                aria-label={t("Store sections", "Sections de la boutique")}
              >
                {permitted.map(([key, title]) => (
                  <button
                    key={key}
                    aria-current={tab === key ? "page" : undefined}
                    className={tab === key ? "active" : ""}
                    onClick={() =>
                      update({ tab: key, page: null, product: null, customer: null, sale: null })
                    }
                  >
                    {title}
                  </button>
                ))}
              </nav>
              {!authorized ? (
                <Empty
                  title={t("Permission required", "Autorisation requise")}
                  description={t(
                    "Ask the store owner to update your staff permissions.",
                    "Demandez au propriétaire de mettre à jour vos autorisations.",
                  )}
                />
              ) : tab === "products" ? (
                <>
                  <div className="panel-heading">
                    <h2>{t("Products", "Produits")}</h2>
                    <button className="button primary small" onClick={() => setAdding(true)}>
                      {t("Add product", "Ajouter un produit")}
                    </button>
                  </div>
                  {products.loading ? (
                    <Loading />
                  ) : products.error ? (
                    <ErrorState message={products.error} retry={refresh} />
                  ) : !products.data?.content.length ? (
                    <Empty
                      title={t("Add your first product", "Ajoutez votre premier produit")}
                      description={t(
                        "Sell products, digital files and services from your store.",
                        "Vendez des produits, des fichiers numériques et des services.",
                      )}
                    >
                      <button className="button primary" onClick={() => setAdding(true)}>
                        {t("Add product", "Ajouter un produit")}
                      </button>
                    </Empty>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {[
                              t("Product", "Produit"),
                              t("Price", "Prix"),
                              t("Stock", "Stock"),
                              t("Status", "Statut"),
                              t("Visibility", "Visibilité"),
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {products.data.content.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <button
                                  className="text-button table-name"
                                  onClick={() => update({ product: p.id })}
                                >
                                  {p.name}
                                </button>
                                <small className="table-subtitle">
                                  {label(p.type)} {p.sku ? `· ${p.sku}` : ""}
                                </small>
                              </td>
                              <td className="amount">{money(p.priceAmount, p.priceCurrency)}</td>
                              <td>
                                {p.inventoryPolicy === "TRACKED"
                                  ? (p.inventoryQuantity ?? 0)
                                  : t("Unlimited", "Illimité")}
                              </td>
                              <td>
                                <Badge value={p.status} />
                              </td>
                              <td>
                                {p.storefrontEnabled === false
                                  ? t("Hidden", "Masqué")
                                  : t("Storefront", "Boutique")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {products.data && (
                    <Pagination
                      page={page}
                      pages={products.data.totalPages}
                      total={products.data.totalElements}
                      onChange={(p) => update({ page: p })}
                    />
                  )}
                </>
              ) : tab === "sales" ? (
                <SalesPanel storeId={s.id} />
              ) : tab === "customers" ? (
                <CustomersPanel storeId={s.id} />
              ) : tab === "reports" ? (
                <ReportsPanel storeId={s.id} />
              ) : tab === "staff" ? (
                <StaffPanel storeId={s.id} />
              ) : (
                <div className="store-settings-actions">
                  <h2>{t("Store settings", "Paramètres de la boutique")}</h2>
                  <p className="muted">
                    {t(
                      "Manage branding, contact details, visibility and media.",
                      "Gérez l’identité visuelle, les coordonnées, la visibilité et les médias.",
                    )}
                  </p>
                  <div className="parity-actions">
                    <button className="button secondary" onClick={() => setEditing(true)}>
                      {t("Edit store", "Modifier la boutique")}
                    </button>
                    {(s.visibility !== "PUBLIC" || s.status !== "ACTIVE") && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() => void mutate("publish")}
                      >
                        {t("Publish", "Publier")}
                      </button>
                    )}
                    <button className="text-button danger-text" onClick={() => setDeleting(true)}>
                      {t("Delete store", "Supprimer la boutique")}
                    </button>
                  </div>
                  {deleting && (
                    <div className="confirmation-box">
                      <p>
                        {t(
                          "Delete this store? It will no longer be available to customers or your team.",
                          "Supprimer cette boutique ? Elle ne sera plus accessible aux clients ni à votre équipe.",
                        )}
                      </p>
                      <div className="parity-actions">
                        <button
                          className="button secondary"
                          onClick={() => setDeleting(false)}
                          disabled={busy}
                        >
                          {t("Back", "Retour")}
                        </button>
                        <button
                          className="button danger"
                          disabled={busy}
                          onClick={() => void mutate("delete")}
                        >
                          {t("Confirm deletion", "Confirmer la suppression")}
                        </button>
                      </div>
                    </div>
                  )}
                  {error && (
                    <p role="alert" className="form-error">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </section>
            {editing && isStoreOwner(s) && (
              <StoreForm store={s} onClose={() => setEditing(false)} />
            )}
            {productId && product.loading && <Loading rows={2} />}{" "}
            {product.error && <ErrorState message={product.error} retry={refresh} />}{" "}
            {product.data && product.data.storeId === s.id && (
              <ProductForm
                store={s}
                product={product.data}
                onClose={() => update({ product: null })}
              />
            )}
          </>
        )
      )}
    </>
  );
}
