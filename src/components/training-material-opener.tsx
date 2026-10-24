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

export function TrainingMaterialOpener({
  productId,
  materialId,
  title,
  author = false,
  onAccessLost,
}: {
  productId: number;
  materialId: string;
  title: string;
  author?: boolean;
  onAccessLost?: () => void;
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
        {author ? t("Preview", "Aperçu") : t("Open material", "Ouvrir la ressource")}
      </button>
      {open && (
        <Modal title={title} onClose={close}>
          {busy ? (
            <Loading rows={2} />
          ) : access ? (
            <>
              <p>{access.fileName || t("Your material is ready.", "Votre ressource est prête.")}</p>
              <a
                className="button primary"
                href={access.url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                <ExternalLink size={16} />
                {access.type === "FILE"
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
