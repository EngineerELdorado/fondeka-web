import { trainingHttpsUrl, type TrainingMaterialAccess } from "./training";

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);
const shortHosts = new Set(["youtu.be", "www.youtu.be"]);
const privateHosts = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);
const videoId = /^[A-Za-z0-9_-]{11}$/;

function startSeconds(value: string | null) {
  if (!value) return undefined;
  let seconds: number;
  if (/^\d+$/.test(value)) seconds = Number(value);
  else {
    const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
    if (!match) return undefined;
    seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  }
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 2147483647
    ? seconds
    : undefined;
}

/** Derive a fixed-origin player from an authorized URL. Never embed user-supplied HTML/hosts. */
export function youtubeEmbedUrl(value: string) {
  try {
    if (!trainingHttpsUrl(value)) return undefined;
    const url = new URL(value);
    if (url.port) return undefined;
    let id: string | undefined;
    if (shortHosts.has(url.hostname)) id = /^\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
    else if (privateHosts.has(url.hostname))
      id = /^\/embed\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
    else if (youtubeHosts.has(url.hostname)) {
      if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1)
        id = url.searchParams.get("v") || undefined;
      else id = /^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1];
    }
    if (!id || !videoId.test(id)) return undefined;
    const player = new URL("https://www.youtube-nocookie.com/embed/" + id);
    player.searchParams.set("autoplay", "0");
    player.searchParams.set("playsinline", "1");
    player.searchParams.set("rel", "0");
    const start = startSeconds(
      url.searchParams.get("start") ??
        url.searchParams.get("t") ??
        new URLSearchParams(url.hash.slice(1)).get("t"),
    );
    if (start) player.searchParams.set("start", String(start));
    return player.href;
  } catch {
    return undefined;
  }
}

export type TrainingVideoSource = { kind: "YOUTUBE" | "FILE"; src: string };
export function trainingVideoSource(
  access: TrainingMaterialAccess,
): TrainingVideoSource | undefined {
  if (!trainingHttpsUrl(access.url)) return undefined;
  if (access.type === "LINK") {
    const src = youtubeEmbedUrl(access.url);
    return src ? { kind: "YOUTUBE", src } : undefined;
  }
  if (
    access.type !== "FILE" ||
    !access.expiresAt ||
    Date.parse(access.expiresAt) <= Date.now() ||
    !Number.isFinite(Date.parse(access.expiresAt))
  )
    return undefined;
  const type =
    typeof access.contentType === "string"
      ? access.contentType.split(";")[0].trim().toLowerCase()
      : undefined;
  const generic = !type || type === "application/octet-stream";
  const video =
    type?.startsWith("video/") ||
    (generic && /\.(mp4|mov|m4v|webm|ogv)$/i.test(access.fileName || new URL(access.url).pathname));
  // Preserve the exact signed URL, including its original query encoding and order.
  return video ? { kind: "FILE", src: access.url } : undefined;
}
