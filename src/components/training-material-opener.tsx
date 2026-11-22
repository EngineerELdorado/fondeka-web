"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Play, RefreshCw } from "lucide-react";
import { request } from "@/lib/data";
import {
  parseMaterialAccess,
  trainingMaterialPath,
  type TrainingMaterialAccess,
} from "@/lib/training";
import { useI18n } from "@/lib/i18n";
import { Modal, Loading } from "./ui";
import type { FileMetadata } from "@/lib/file-metadata";
import { FileDetails } from "./file-details";
import { trainingVideoSource } from "@/lib/training-video";
import { TrainingVideoPlayer } from "./training-video-player";

export function TrainingMaterialOpener({
  productId,
  materialId,
  title,
  author = false,
  actionLabel,
  onAccessLost,
  fileMetadata,
}: {
  productId: number;
  materialId: string;
  title: string;
  author?: boolean;
  actionLabel?: string;
  onAccessLost?: () => void;
  fileMetadata?: FileMetadata;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [access, setAccess] = useState<TrainingMaterialAccess>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!access?.expiresAt) return;
    const timer = setTimeout(
      () => {
        setAccess(undefined);
        setError(
          t(
            "This file link expired. Request a new one to continue.",
            "Ce lien de fichier a expiré. Demandez-en un nouveau pour continuer.",
          ),
        );
      },
      Math.max(0, Date.parse(access.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [access, t]);
  async function load() {
    if (controller.current) return;
    const task = new AbortController();
    controller.current = task;
    setOpen(true);
    setBusy(true);
    setError("");
    setAccess(undefined);
    try {
      const result = parseMaterialAccess(
        await request(trainingMaterialPath(productId, materialId, "access", author), {
          signal: task.signal,
        }),
        materialId,
      );
      if (!task.signal.aborted) setAccess(result);
    } catch (failure) {
      if (!task.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : t("Unable to open this material.", "Impossible d’ouvrir cette ressource."),
        );
        onAccessLost?.();
      }
    } finally {
      if (!task.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }
  const close = () => {
    controller.current?.abort();
    controller.current = null;
    setOpen(false);
    setAccess(undefined);
    setError("");
    setBusy(false);
  };
  const video = access ? trainingVideoSource(access) : undefined;
  return (
    <>
      <button
        type="button"
        className="button secondary small"
        aria-haspopup="dialog"
        disabled={busy}
        onClick={() => void load()}
      >
        <Play size={15} />
        {actionLabel ||
          (author ? t("Preview", "Aperçu") : t("Open material", "Ouvrir la ressource"))}
      </button>
      {open && (
        <Modal
          title={title}
          onClose={close}
          className={video ? "training-video-dialog" : undefined}
        >
          {busy ? (
            <Loading rows={2} />
          ) : access ? (
            <>
              {access.type === "FILE" ? (
                <FileDetails
                  metadata={{
                    ...fileMetadata,
                    fileName: access.fileName ?? fileMetadata?.fileName,
                    contentType: access.contentType ?? fileMetadata?.contentType,
                  }}
                />
              ) : !video ? (
                <p>{t("Your material is ready.", "Votre ressource est prête.")}</p>
              ) : null}
              {video && <TrainingVideoPlayer key={video.src} source={video} title={title} />}
              {video?.kind === "YOUTUBE" && (
                <p className="muted small training-video-help">
                  {t(
                    "If the video is unavailable here, you can open it on YouTube.",
                    "Si la vidéo est indisponible ici, vous pouvez l’ouvrir sur YouTube.",
                  )}
                </p>
              )}
              <a
                className={`button ${video ? "secondary" : "primary"}`}
                href={access.url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                <ExternalLink size={16} />
                {video?.kind === "YOUTUBE"
                  ? t("Open on YouTube", "Ouvrir sur YouTube")
                  : video?.kind === "FILE"
                    ? t("Open original video", "Ouvrir la vidéo originale")
                    : access.type === "FILE"
                      ? t("Open file", "Ouvrir le fichier")
                      : t("Open link", "Ouvrir le lien")}
              </a>
            </>
          ) : (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={close}>
              {t("Close", "Fermer")}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={14} />
              {t("Refresh access", "Actualiser l’accès")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
