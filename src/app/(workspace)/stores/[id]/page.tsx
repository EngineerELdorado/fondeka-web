"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Package,
  QrCode,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useQuery } from "@/lib/use-query";
import { request } from "@/lib/data";
import { invalidateQueryPaths } from "@/lib/query-cache";
import { canUseStore, isStoreOwner, storeTabAllowed, storeUpdateInput } from "@/lib/commerce";
import { money, label } from "@/lib/format";
import type { Store, Product, Page } from "@/lib/types";
import { Badge, PageHeading, Loading, Empty, ErrorState, Pagination, Modal } from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { StoreForm } from "@/components/store-form";
import { ProductForm } from "@/components/product-form";
import { ProductImage } from "@/components/product-image";
import { MediaVideo } from "@/components/media-video";
import { CustomersPanel, StaffPanel } from "@/components/store-people";
import { ReportsPanel, SalesPanel } from "@/components/store-sales";
import { LinkSharing } from "@/components/link-sharing";
import { StoreMedia } from "@/components/store-media";
import { StoreDescription } from "@/components/store-description";
import { TrainingEditor } from "@/components/training-editor";
import { hasToolAccess } from "@/lib/business-tools";
import { useBusinessTools, useToolNavigation } from "@/components/business-tools-provider";
const storeTabIcons: Record<string, LucideIcon> = {
  products: Package,
  sales: ReceiptText,
  customers: Users,
  reports: BarChart3,
  staff: ShieldCheck,
  settings: Settings2,
};
export default function StoreDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const { state: businessAccess } = useBusinessTools();
  const toolNavigation = useToolNavigation();
  const posOnly =
    !!businessAccess.accountAccess &&
    !hasToolAccess(businessAccess.accountAccess, "ONLINE_STORES") &&
    hasToolAccess(businessAccess.accountAccess, "POS");
  const { values, update, page } = useUrlState();
  const { refresh, notify } = useWorkspace();
  const router = useRouter();
  const store = useQuery<Store>(/^\d+$/.test(id) ? `/customer-api/commerce/stores/${id}` : null);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
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
    s && authorized && tab === "products" && !values.get("training")
      ? `/customer-api/commerce/stores/${id}/products?page=${page}&size=20`
      : null,
  );
  const productId = values.get("product");
  const trainingId = values.get("training");
  const trainingProduct = useQuery<Product>(
    s && canUseStore(s, "PRODUCTS") && trainingId && /^\d+$/.test(trainingId)
      ? `/customer-api/commerce/products/${trainingId}`
      : null,
  );
  const product = useQuery<Product>(
    s && canUseStore(s, "PRODUCTS") && productId && /^\d+$/.test(productId)
      ? `/customer-api/commerce/products/${productId}`
      : null,
  );
  async function mutate(mode: "delete" | "publish") {
    if (!s || busy) return;
    if (
      mode === "publish" &&
      toolNavigation.enabled &&
      businessAccess.accountAccess &&
      !hasToolAccess(businessAccess.accountAccess, "ONLINE_STORES")
    ) {
      toolNavigation.open(
        window.location.pathname + window.location.search,
        false,
        "ONLINE_STORES",
      );
      return;
    }
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
      if (mode === "delete") router.push(posOnly ? "/stores?mode=pos" : "/stores");
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
  if (trainingId && s && canUseStore(s, "PRODUCTS")) {
    if (trainingProduct.loading) return <Loading />;
    if (trainingProduct.error)
      return <ErrorState message={trainingProduct.error} retry={trainingProduct.refetch} />;
    if (trainingProduct.data?.type === "TRAINING" && trainingProduct.data.storeId === s.id)
      return (
        <TrainingEditor
          productId={trainingProduct.data.id}
          onClose={() => update({ training: null, tab: "products" })}
          onProductSettings={() => update({ training: null, product: trainingId })}
        />
      );
    return (
      <Empty
        title={t("Training unavailable", "Formation indisponible")}
        description={t(
          "Choose a training product from this store.",
          "Choisissez un produit de formation de cette boutique.",
        )}
      >
        <button
          type="button"
          className="button secondary"
          onClick={() => update({ training: null })}
        >
          {t("Back to products", "Retour aux produits")}
        </button>
      </Empty>
    );
  }
  if (adding && s && canUseStore(s, "PRODUCTS"))
    return (
      <ProductForm
        store={s}
        onClose={() => setAdding(false)}
        onSaved={(p) =>
          p.type === "TRAINING"
            ? update({ product: null, training: p.id })
            : update({ product: p.id })
        }
      />
    );
  return (
    <>
      <Link href={posOnly ? "/stores?mode=pos" : "/stores"} className="back-link">
        ←{" "}
        {posOnly
          ? t("Select a store", "Choisir une boutique")
          : t("Online Stores", "Boutiques en ligne")}
      </Link>
      {store.loading ? (
        <Loading />
      ) : store.error ? (
        <ErrorState message={store.error} retry={refresh} />
      ) : (
        s && (
          <>
            <section className="store-profile-header">
              <StoreMedia store={s} profile />
              <PageHeading title={s.name} description="">
                <button className="button secondary" onClick={refresh}>
                  {t("Refresh", "Actualiser")}
                </button>
                {isStoreOwner(s) && (
                  <button className="button secondary" onClick={() => setEditing(true)}>
                    {t("Edit store", "Modifier la boutique")}
                  </button>
                )}
                <button
                  type="button"
                  className="button secondary"
                  aria-haspopup="dialog"
                  onClick={() => setSharing(true)}
                >
                  <QrCode size={16} aria-hidden="true" />
                  {t("Link & QR", "Lien et QR")}
                </button>
                {canUseStore(s, "POS") && (
                  <Link href={`/stores/${s.id}/pos`} className="button primary">
                    {t("Open POS", "Ouvrir le POS")}
                  </Link>
                )}
              </PageHeading>
              {s.description && <StoreDescription key={s.id} description={s.description} />}
            </section>
            <div className="store-detail-summary">
              <Badge value={s.status} />
              <Badge value={s.visibility} />
              <strong>{s.defaultCurrency}</strong>
            </div>
            {sharing && (
              <Modal
                title={t("Store link and QR code", "Lien et code QR de la boutique")}
                description={s.name}
                onClose={() => setSharing(false)}
              >
                <LinkSharing url={s.storefrontUrl || s.publicUrl} title={s.name} showQr />
              </Modal>
            )}
            <section className="panel">
              <nav
                className="owner-tabs"
                aria-label={t("Store sections", "Sections de la boutique")}
              >
                {permitted.map(([key, title]) => {
                  const Icon = storeTabIcons[key];
                  return (
                    <button
                      key={key}
                      aria-current={tab === key ? "page" : undefined}
                      className={tab === key ? "active" : ""}
                      onClick={() =>
                        update({ tab: key, page: null, product: null, customer: null, sale: null })
                      }
                    >
                      <Icon size={17} aria-hidden="true" />
                      {title}
                    </button>
                  );
                })}
              </nav>
              {!authorized ? (
                <Empty
                  icon={ShieldCheck}
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
                      icon={Package}
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
                                <div className="owner-product-identity">
                                  <span className="owner-product-thumb">
                                    <ProductImage product={p} />
                                  </span>
                                  <div>
                                    <button
                                      className="text-button table-name"
                                      onClick={() => update({ product: p.id })}
                                    >
                                      {p.name}
                                    </button>
                                    {p.type === "TRAINING" && (
                                      <button
                                        type="button"
                                        className="text-button"
                                        onClick={() => update({ training: p.id, product: null })}
                                      >
                                        {t("Manage curriculum", "Gérer le programme")}
                                      </button>
                                    )}
                                    <small className="table-subtitle">
                                      {label(p.type)} {p.sku ? `· ${p.sku}` : ""}
                                    </small>
                                    <MediaVideo
                                      url={p.videoUrl}
                                      title={p.name}
                                      duration={p.videoDurationSeconds}
                                    />
                                  </div>
                                </div>
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
