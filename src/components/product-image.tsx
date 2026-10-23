"use client";
import { useState } from "react";
import { Package } from "lucide-react";
import { safeLink } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductImage({ product }: { product: Product }) {
  const source = safeLink(product.image1 || product.imageUrl || product.thumbnailUrl);
  return <ProductPhoto key={source} source={source} name={product.name} />;
}

function ProductPhoto({ source, name }: { source?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return source && !failed ? (
    <img
      src={source}
      alt={name}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="product-photo-fallback" aria-hidden="true">
      <Package size={36} strokeWidth={1.25} />
    </span>
  );
}
