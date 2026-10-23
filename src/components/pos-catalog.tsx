"use client";
import { useEffect, useRef } from "react";
import { Plus, Check, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductImage } from "./product-image";

export function PosCatalog({
  products,
  cart,
  disabled,
  onAdd,
}: {
  products: Product[];
  cart: { product: Product; quantity: number }[];
  disabled: boolean;
  onAdd: (product: Product) => void;
}) {
  const { t } = useI18n();
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = grid.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    // Measure the content, not the stretched grid cell. Preserve DOM/keyboard order.
    const observer = new ResizeObserver((entries) => {
      for (const { target } of entries) {
        const cell = target.parentElement;
        if (cell)
          cell.style.gridRowEnd = `span ${Math.ceil((target.getBoundingClientRect().height + 16) / 8)}`;
      }
    });
    for (const card of element.querySelectorAll(".pos-product")) observer.observe(card);
    element.dataset.masonry = "true";
    return () => observer.disconnect();
  }, [products]);
  return (
    <div ref={grid} className="pos-catalog-grid" role="list" aria-label={t("Products", "Produits")}>
      {products.map((product) => {
        const quantity = cart.find((line) => line.product.id === product.id)?.quantity || 0;
        const outOfStock =
          product.inventoryPolicy === "TRACKED" &&
          Number(product.inventoryQuantity ?? 0) <= quantity;
        const unavailable = product.status !== "ACTIVE" || outOfStock;
        return (
          <div className="pos-catalog-cell" role="listitem" key={product.id}>
            <button
              type="button"
              className={`pos-product ${quantity ? "is-selected" : ""}`}
              disabled={disabled || unavailable}
              onClick={() => onAdd(product)}
              aria-label={`${t("Add", "Ajouter")} ${product.name} · ${money(product.priceAmount, product.priceCurrency)}${quantity ? ` · ${quantity} ${t("in sale", "dans la vente")}` : ""}${unavailable ? ` · ${t("Unavailable", "Indisponible")}` : ""}`}
            >
              <span className="pos-product-photo">
                <ProductImage product={product} />
                {quantity > 0 && (
                  <span className="pos-product-count">
                    <Check size={12} />
                    {quantity}
                  </span>
                )}
                {product.videoUrl && (
                  <span
                    className="pos-product-video"
                    aria-label={t("Video added", "Vidéo ajoutée")}
                  >
                    <Play size={12} fill="currentColor" />
                  </span>
                )}
              </span>
              <span className="pos-product-info">
                <strong className="pos-product-name">{product.name}</strong>
                {(product.sku || product.barcodeOrQrCode) && (
                  <small className="pos-product-code">
                    {product.sku || product.barcodeOrQrCode}
                  </small>
                )}
                <span className="pos-product-bottom">
                  <strong>{money(product.priceAmount, product.priceCurrency)}</strong>
                  <span className="pos-product-add" aria-hidden="true">
                    <Plus size={18} />
                  </span>
                </span>
                {unavailable && (
                  <small className="pos-product-unavailable">
                    {outOfStock
                      ? t("No stock remaining", "Aucun stock restant")
                      : t("Unavailable", "Indisponible")}
                  </small>
                )}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
