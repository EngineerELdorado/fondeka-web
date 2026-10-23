"use client";
import { useState, type ReactNode } from "react";
import { safeLink } from "@/lib/format";
import type { Store } from "@/lib/types";

function StoreImage({
  src,
  className,
  eager = false,
  fallback = null,
}: {
  src: string;
  className: string;
  eager?: boolean;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    fallback
  ) : (
    <img
      src={src}
      alt=""
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function StoreAvatar({
  store,
  className = "",
  eager = false,
}: {
  store: Pick<Store, "name" | "logoUrl">;
  className?: string;
  eager?: boolean;
}) {
  const logo = safeLink(store.logoUrl || undefined);
  const initial = <span>{Array.from(store.name.trim())[0]?.toLocaleUpperCase() || "F"}</span>;
  return (
    <span className={`store-avatar ${className}`} aria-hidden="true">
      {logo ? (
        <StoreImage
          key={logo}
          src={logo}
          className="store-avatar-image"
          eager={eager}
          fallback={initial}
        />
      ) : (
        initial
      )}
    </span>
  );
}

export function StoreMedia({
  store,
  profile = false,
  tone = 0,
}: {
  store: Pick<Store, "name" | "logoUrl" | "bannerUrl" | "defaultCurrency">;
  profile?: boolean;
  tone?: number;
}) {
  const banner = safeLink(store.bannerUrl || undefined);
  return (
    <div
      className={`store-media ${profile ? "store-media-profile" : "store-media-card"} tone-${tone % 3}`}
    >
      {banner && (
        <StoreImage key={banner} src={banner} className="store-media-banner" eager={profile} />
      )}
      <StoreAvatar store={store} eager={profile} />
      {!profile && <span className="store-media-currency">{store.defaultCurrency}</span>}
    </div>
  );
}
