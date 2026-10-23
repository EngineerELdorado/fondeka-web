export type VideoScope = "commerce-store-videos" | "commerce-product-videos";

// Cleanup is narrower than display: external media and signed URLs are never deleted.
export function managedVideoCleanupCandidates(
  scope: VideoScope,
  previous: (string | null | undefined)[],
  retained: (string | null | undefined)[],
  publicBase?: string,
): string[] {
  return [...new Set(previous)].filter((value): value is string => {
    if (!value || retained.includes(value)) return false;
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        return false;
      let path = url.pathname;
      if (publicBase) {
        const base = new URL(publicBase);
        const prefix = base.pathname.replace(/\/$/, "") + "/";
        if (base.protocol !== "https:" || url.origin !== base.origin || !path.startsWith(prefix))
          return false;
        path = path.slice(prefix.length - 1);
      } else if (
        ![
          "cdn.fondeka.com",
          "fondeka-media.s3.amazonaws.com",
          "fondeka-media-dev.s3.amazonaws.com",
          "fondeka-media-prod.s3.amazonaws.com",
        ].includes(url.hostname)
      )
        return false;
      return new RegExp(`^/${scope}/[1-9][0-9]*/[A-Za-z0-9_-]+\\.(mp4|mov)$`, "i").test(path);
    } catch {
      return false;
    }
  });
}
