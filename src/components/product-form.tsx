"use client";
import { useRef, useState, type FormEvent } from "react";
import { useCurrencies } from "@/lib/use-currencies";
import { useI18n } from "@/lib/i18n";
import { label, parseAmount } from "@/lib/format";
import { request } from "@/lib/data";
import { managedVideoCleanupCandidates } from "@/lib/media";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Product, Store } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";
import { MediaUpload } from "./media-upload";
import { ProductCreateFlow } from "./product-create-flow";
import { LinkSharing } from "./link-sharing";
import { useWorkspace } from "./workspace-provider";
export function ProductForm(props: {
  store: Store;
  product?: Product;
  onClose: () => void;
  onSaved?: (product: Product) => void;
}) {
  return props.product ? (
    <ProductEditor {...props} />
  ) : (
    <ProductCreateFlow store={props.store} onClose={props.onClose} onSaved={props.onSaved} />
  );
}
function ProductEditor({
  store,
  product,
  onClose,
  onSaved,
}: {
  store: Store;
  product?: Product;
  onClose: () => void;
  onSaved?: (p: Product) => void;
}) {
  const { t } = useI18n();
  const { notify } = useWorkspace();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState(product?.type || "PHYSICAL");
  const [currency, setCurrency] = useState(product?.priceCurrency || store.defaultCurrency);
  const { currencies } = useCurrencies([currency, store.defaultCurrency]);
  const [images, setImages] = useState([
    product?.image1 || product?.imageUrl || "",
    product?.image2 || "",
    product?.image3 || "",
    product?.image4 || "",
  ]);
  const [video, setVideo] = useState(product?.videoUrl || "");
  const [duration, setDuration] = useState(product?.videoDurationSeconds);
  const [asset, setAsset] = useState(product?.digitalAssetKey || "");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || uploading) return;
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const price = parseAmount(String(f.get("amount")), currency);
      const stock = Number(f.get("stock"));
      if (type === "PHYSICAL" && (!Number.isSafeInteger(stock) || stock < 0))
        throw new Error(t("Enter valid stock.", "Saisissez un stock valide."));
      const body = {
        name: String(f.get("name")).trim(),
        description: String(f.get("description")).trim(),
        slug: String(f.get("slug") || "").trim() || undefined,
        priceAmount: price,
        priceCurrency: currency,
        type,
        ...Object.fromEntries(images.map((v, i) => [`image${i + 1}`, v || null])),
        imageUrl: images[0] || null,
        videoUrl: video || null,
        videoDurationSeconds: duration || null,
        videoThumbnailUrl: product?.videoUrl === video ? product?.videoThumbnailUrl || null : null,
        inventoryPolicy: type === "PHYSICAL" ? String(f.get("inventoryPolicy")) : "UNLIMITED",
        inventoryQuantity: type === "PHYSICAL" ? stock : null,
        requiresShipping: type === "PHYSICAL" && f.get("requiresShipping") === "on",
        sku: String(f.get("sku") || "").trim(),
        barcodeOrQrCode: String(f.get("barcode") || "").trim(),
        fulfillmentUrl: ["DIGITAL", "SERVICE"].includes(type)
          ? String(f.get("fulfillmentUrl") || "").trim() || null
          : null,
        fulfillmentInstructions: ["DIGITAL", "SERVICE"].includes(type)
          ? String(f.get("fulfillmentInstructions") || "").trim() || null
          : null,
        digitalAssetKey: type === "DIGITAL" ? asset || null : null,
        status: String(f.get("status")),
        storefrontEnabled: f.get("storefront") === "on",
        directLinkEnabled: f.get("direct") === "on",
        marketplaceEnabled: f.get("marketplace") === "on",
        marketplaceCategory: String(f.get("category") || "").trim() || null,
      };
      lock.current = true;
      setBusy(true);
      const saved = await request<Product>(
        product
          ? `/customer-api/commerce/products/${product.id}`
          : `/customer-api/commerce/stores/${store.id}/products`,
        { method: product ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      for (const url of managedVideoCleanupCandidates(
        "commerce-product-videos",
        [product?.videoUrl],
        [saved.videoUrl],
        process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
      )) {
        try {
          await request("/customer-api/storage/object", {
            method: "DELETE",
            body: JSON.stringify({ publicUrl: url, url }),
          });
        } catch {
          notify(
            t(
              "Product saved. The previous video could not be removed; contact support.",
              "Produit enregistré. L’ancienne vidéo n’a pas pu être supprimée ; contactez l’assistance.",
            ),
          );
        }
      }
      invalidateQueryPaths([
        "/customer-api/commerce/stores/" + store.id + "/products",
        "/customer-api/commerce/stores/" + store.id + "/pos/products/search",
        "/customer-api/commerce/products/" + saved.id,
      ]);
      notify(t("Product saved.", "Produit enregistré."));
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to save product.", "Impossible d’enregistrer le produit."),
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <Modal
      title={t(
        product ? "Edit product" : "Add product",
        product ? "Modifier le produit" : "Ajouter un produit",
      )}
      description={store.name}
      busy={busy || uploading}
      onClose={onClose}
      className="owner-form-dialog"
    >
      <form className="form-stack" onSubmit={submit}>
        <section className="form-section">
          <h3>1. {t("Name", "Nom")}</h3>
          <label>
            {t("Product name", "Nom du produit")}
            <input name="name" defaultValue={product?.name} required maxLength={180} autoFocus />
          </label>
          {product && (
            <label>
              {t("Slug", "Identifiant du lien")}
              <input name="slug" defaultValue={product.slug} maxLength={220} />
            </label>
          )}
        </section>
        <section className="form-section">
          <h3>2. {t("Price", "Prix")}</h3>
          <div className="form-grid">
            <label>
              {t("Price", "Prix")}
              <input
                name="amount"
                defaultValue={product?.priceAmount}
                required
                inputMode="decimal"
              />
            </label>
            <label>
              {t("Currency", "Devise")}
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="form-section">
          <h3>3. {t("Photos and video", "Photos et vidéo")}</h3>
          <div className="product-media-slots">
            {images.map((v, i) => (
              <MediaUpload
                disabled={uploading}
                key={i}
                compact={i > 0}
                scope="commerce-product-images"
                label={
                  i === 0
                    ? t("Primary photo", "Photo principale")
                    : `${t("Gallery photo", "Photo de galerie")} ${i + 1}`
                }
                ownerName={product?.name}
                aspect={1}
                value={v}
                onBusy={setUploading}
                onChange={(v) => setImages(images.map((p, j) => (i === j ? v : p)))}
              />
            ))}
          </div>
          <MediaUpload
            disabled={uploading}
            label={t("Product video", "Vidéo du produit")}
            kind="video"
            value={video}
            duration={duration}
            ownerName={product?.name}
            storeId={store.id}
            scope="commerce-product-videos"
            maxBytes={store.effectiveProductVideoMaxBytes}
            maxSeconds={store.effectiveProductVideoMaxDurationSeconds || 30}
            onBusy={setUploading}
            onChange={(v, d) => {
              setVideo(v);
              setDuration(d);
            }}
          />
        </section>
        <section className="form-section">
          <h3>4. {t("Description", "Description")}</h3>
          <label>
            {t("Description", "Description")}
            <textarea name="description" defaultValue={product?.description} required rows={4} />
          </label>
        </section>
        <section className="form-section">
          <h3>5. {t("Type", "Type")}</h3>
          <label>
            {t("Product type", "Type de produit")}
            <select
              value={type}
              disabled={product?.type === "TRAINING"}
              onChange={(e) => setType(e.target.value)}
            >
              {(product?.type === "TRAINING"
                ? ["TRAINING"]
                : ["PHYSICAL", "DIGITAL", "SERVICE"]
              ).map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          {type === "TRAINING" && (
            <p className="info-box">
              {t(
                "Training type is permanent. Manage paid lessons in the curriculum. Publish only after saving at least one published material in a published module.",
                "Le type Formation est définitif. Gérez les leçons payantes dans le programme. Publiez après avoir enregistré au moins une ressource publiée dans un module publié.",
              )}
            </p>
          )}
          {["DIGITAL", "SERVICE"].includes(type) && (
            <>
              <label>
                {type === "SERVICE"
                  ? t("Booking link", "Lien de réservation")
                  : t("Digital access link", "Lien d’accès numérique")}
                <input
                  name="fulfillmentUrl"
                  type="url"
                  maxLength={1024}
                  defaultValue={product?.fulfillmentUrl}
                />
              </label>
              <label>
                {t("Fulfillment instructions", "Instructions de livraison ou d’accès")}
                <textarea
                  name="fulfillmentInstructions"
                  defaultValue={product?.fulfillmentInstructions}
                />
              </label>
            </>
          )}
          {type === "DIGITAL" && (
            <MediaUpload
              disabled={uploading}
              kind="digital"
              label={t("Digital file", "Fichier numérique")}
              value={asset}
              storeId={store.id}
              scope="commerce-digital-assets"
              onBusy={setUploading}
              onChange={setAsset}
            />
          )}
        </section>
        <section className="form-section">
          <h3>6. {t("Stock and identification", "Stock et identification")}</h3>
          {type === "PHYSICAL" && (
            <>
              <label>
                {t("Inventory", "Inventaire")}
                <select name="inventoryPolicy" defaultValue={product?.inventoryPolicy || "TRACKED"}>
                  <option value="TRACKED">{t("Track stock", "Suivre le stock")}</option>
                  <option value="UNLIMITED">{t("Unlimited", "Illimité")}</option>
                </select>
              </label>
              <label>
                {t("Stock quantity", "Quantité en stock")}
                <input
                  name="stock"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={product?.inventoryQuantity ?? 0}
                  required
                />
              </label>
              <label className="checkbox-label">
                <input
                  name="requiresShipping"
                  type="checkbox"
                  defaultChecked={product?.requiresShipping ?? true}
                />
                {t("Requires shipping", "Nécessite une livraison")}
              </label>
            </>
          )}
          <div className="form-grid">
            <label>
              SKU
              <input name="sku" defaultValue={product?.sku} maxLength={120} />
            </label>
            <label>
              {t("Barcode / QR value", "Valeur du code-barres / QR")}
              <input name="barcode" defaultValue={product?.barcodeOrQrCode} maxLength={512} />
            </label>
          </div>
        </section>
        <section className="form-section">
          <h3>7. {t("Visibility and availability", "Visibilité et disponibilité")}</h3>
          <label>
            {t("Status", "Statut")}
            <select name="status" defaultValue={product?.status || "ACTIVE"}>
              {["DRAFT", "ACTIVE", "SUSPENDED"].map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </label>
          {[
            [
              "storefront",
              t("Visible on storefront", "Visible dans la boutique"),
              product?.storefrontEnabled ?? true,
            ],
            [
              "direct",
              t("Available by direct link", "Disponible par lien direct"),
              product?.directLinkEnabled ?? true,
            ],
            [
              "marketplace",
              t("Request Marketplace listing", "Demander la publication sur le Marketplace"),
              product?.marketplaceEnabled ?? true,
            ],
          ].map(([name, title, checked]) => (
            <label className="checkbox-label" key={String(name)}>
              <input type="checkbox" name={String(name)} defaultChecked={!!checked} />
              {title}
            </label>
          ))}
          <label>
            {t("Marketplace category", "Catégorie Marketplace")}
            <input name="category" defaultValue={product?.marketplaceCategory} maxLength={120} />
          </label>
          {product && (
            <p className="muted">
              {t("Marketplace review", "Validation Marketplace")}:{" "}
              {product.marketplaceApproved
                ? t("Approved", "Approuvé")
                : t("Not approved", "Non approuvé")}
            </p>
          )}
        </section>
        {product && (
          <LinkSharing url={product.productUrl || product.publicUrl} title={product.name} />
        )}{" "}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading}
            onClick={onClose}
          >
            {t("Cancel", "Annuler")}
          </button>
          <SubmitButton busy={busy} disabled={uploading}>
            {t("Save", "Enregistrer")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
