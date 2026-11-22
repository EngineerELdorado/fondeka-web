"use client";
import { useEffect, useRef, useState } from "react";
import type { TrainingVideoSource } from "@/lib/training-video";
import { useI18n } from "@/lib/i18n";

export function TrainingVideoPlayer({
  source,
  title,
}: {
  source: TrainingVideoSource;
  title: string;
}) {
  if (source.kind === "YOUTUBE")
    return (
      <div className="training-video-stage">
        <iframe
          src={source.src}
          title={title}
          // YouTube requires a Referer; send only our origin, never a private lesson path/query.
          referrerPolicy="strict-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  return <UploadedVideo key={source.src} src={source.src} title={title} />;
}

function UploadedVideo({ src, title }: { src: string; title: string }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
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
    <>
      <div className="training-video-stage">
        <video
          ref={video}
          src={src}
          controls
          playsInline
          preload="metadata"
          aria-label={title}
          onError={() => setFailed(true)}
        />
      </div>
      {failed && (
        <p className="form-error" role="alert">
          {t(
            "This video could not be played here. Refresh access or open the original file below.",
            "Cette vidéo ne peut pas être lue ici. Actualisez l’accès ou ouvrez le fichier original ci-dessous.",
          )}
        </p>
      )}
    </>
  );
}
