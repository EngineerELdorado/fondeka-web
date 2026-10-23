"use client";
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { safeLink } from "@/lib/format";
import { Modal } from "./ui";

export function MediaVideo({
  url,
  title,
  duration,
}: {
  url?: string | null;
  title: string;
  duration?: number | null;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!safeLink(url || undefined)) return null;
  return (
    <>
      <button
        type="button"
        className="media-video-trigger"
        onClick={() => setOpen(true)}
        aria-label={`${t("Play video", "Lire la vidéo")} · ${title}`}
      >
        <span className="media-play-icon">
          <Play size={18} fill="currentColor" />
        </span>
        <span>
          <strong>{t("Video added", "Vidéo ajoutée")}</strong>
          <small>
            {duration && duration > 0 ? `${duration} s · ` : ""}
            {t("Watch video", "Voir la vidéo")}
          </small>
        </span>
      </button>
      {open && <VideoPlayer url={url!} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function VideoPlayer({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  useEffect(() => {
    const player = video.current;
    const pause = () => {
      if (document.hidden) player?.pause();
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      document.removeEventListener("visibilitychange", pause);
      player?.pause();
      if (player && document.pictureInPictureElement === player)
        void document.exitPictureInPicture().catch(() => {});
    };
  }, []);
  return (
    <Modal title={title} onClose={onClose} className="media-player-dialog">
      <div className="media-player-stage">
        <video
          ref={video}
          src={url}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          onLoadStart={() => setState("loading")}
          onCanPlay={() => setState("ready")}
          onError={() => setState("error")}
        />
        {state === "loading" && (
          <p role="status" className="media-player-status">
            {t("Loading video…", "Chargement de la vidéo…")}
          </p>
        )}
      </div>
      {state === "error" && (
        <div className="media-player-error" role="alert">
          <p>{t("This video could not be loaded.", "Impossible de charger cette vidéo.")}</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setState("loading");
              video.current?.load();
            }}
          >
            {t("Retry", "Réessayer")}
          </button>
        </div>
      )}
    </Modal>
  );
}
