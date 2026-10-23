"use client";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/data";
import { safeLink } from "@/lib/format";
import { demoMode } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
interface Presign {
  url: string;
  method: string;
  headers: Record<string, string>;
  publicUrl?: string;
  key: string;
  maxBytes: number;
}
export function MediaUpload({
  label,
  value,
  onChange,
  scope,
  storeId,
  kind = "image",
  maxBytes,
  maxSeconds = 30,
  onBusy,
  disabled = false,
}: {
  label: string;
  value?: string | null;
  onChange: (url: string, duration?: number) => void;
  scope: string;
  storeId?: number;
  kind?: "image" | "video" | "digital";
  maxBytes?: number;
  maxSeconds?: number;
  onBusy?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const xhr = useRef<XMLHttpRequest | null>(null);
  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
      xhr.current?.abort();
    };
  }, []);
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    onBusy?.(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const accepted =
        kind === "image"
          ? ["jpg", "jpeg", "png", "webp", "heic", "heif"]
          : kind === "video"
            ? ["mp4", "mov"]
            : [
                "pdf",
                "epub",
                "txt",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "zip",
                "mp3",
                "m4a",
                "mp4",
                "mov",
              ];
      if (!accepted.includes(ext))
        throw new Error(
          t("Choose a supported file type.", "Choisissez un type de fichier compatible."),
        );
      const localCap =
        maxBytes ??
        (kind === "image"
          ? 10 * 1024 * 1024
          : kind === "digital"
            ? 250 * 1024 * 1024
            : 50 * 1024 * 1024);
      if (file.size <= 0 || file.size > localCap)
        throw new Error(
          t("This file is too large or empty.", "Ce fichier est trop volumineux ou vide."),
        );
      let duration: number | undefined;
      if (kind === "video") {
        const url = URL.createObjectURL(file);
        try {
          duration = await new Promise<number>((resolve, reject) => {
            const video = document.createElement("video");
            const cleanup = () => {
              clearTimeout(timer);
              controller.signal.removeEventListener("abort", cancel);
              video.onloadedmetadata = null;
              video.onerror = null;
              video.removeAttribute("src");
              video.load();
            };
            const cancel = () => {
              cleanup();
              reject(new DOMException("Aborted", "AbortError"));
            };
            const fail = () => {
              cleanup();
              reject(
                new Error(t("This video cannot be read.", "Cette vidéo ne peut pas être lue.")),
              );
            };
            const timer = setTimeout(fail, 15000);
            controller.signal.addEventListener("abort", cancel, { once: true });
            video.preload = "metadata";
            video.onloadedmetadata = () => {
              const seconds = video.duration;
              cleanup();
              resolve(seconds);
            };
            video.onerror = fail;
            video.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (!Number.isFinite(duration) || duration! <= 0 || duration! > maxSeconds)
          throw new Error(
            t(
              `Choose a video of ${maxSeconds} seconds or less.`,
              `Choisissez une vidéo de ${maxSeconds} secondes maximum.`,
            ),
          );
      }
      if (demoMode) {
        throw new Error(
          t(
            "File uploads need a connected account. Demo data stays in this browser.",
            "L’envoi de fichiers nécessite un compte connecté. Les données de démonstration restent dans ce navigateur.",
          ),
        );
      }
      const contentType =
        file.type ||
        (
          {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            webp: "image/webp",
            mp4: "video/mp4",
            mov: "video/quicktime",
            zip: "application/zip",
            pdf: "application/pdf",
          } as Record<string, string>
        )[ext] ||
        "application/octet-stream";
      const endpoint =
        kind === "digital"
          ? `/customer-api/commerce/stores/${storeId}/products/digital-assets/presign`
          : "/customer-api/storage/presign";
      const signed = await request<Presign>(endpoint, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ scope, storeId, contentType, ext }),
      });
      if (controller.signal.aborted) return;
      if (file.size > signed.maxBytes)
        throw new Error(
          t(
            "This file exceeds the server upload limit.",
            "Ce fichier dépasse la limite d’envoi du serveur.",
          ),
        );
      const destination = new URL(signed.url);
      if (
        destination.protocol !== "https:" ||
        signed.method !== "PUT" ||
        (kind === "digital" ? !signed.key : !signed.publicUrl || !safeLink(signed.publicUrl))
      )
        throw new Error(
          t("The upload destination is invalid.", "La destination d’envoi est invalide."),
        );
      await new Promise<void>((resolve, reject) => {
        const task = new XMLHttpRequest();
        xhr.current = task;
        task.open("PUT", signed.url);
        for (const [key, v] of Object.entries(signed.headers)) task.setRequestHeader(key, v);
        task.upload.onprogress = (e) => {
          if (e.lengthComputable && mounted.current)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        task.onload = () =>
          task.status >= 200 && task.status < 300
            ? resolve()
            : reject(
                new Error(
                  t("Upload failed. Please try again.", "Échec de l’envoi. Veuillez réessayer."),
                ),
              );
        task.onerror = () =>
          reject(
            new Error(
              t(
                "Upload failed. Check your connection.",
                "Échec de l’envoi. Vérifiez votre connexion.",
              ),
            ),
          );
        task.onabort = () => reject(new DOMException("Aborted", "AbortError"));
        controller.signal.addEventListener("abort", () => task.abort(), { once: true });
        task.send(file);
      });
      if (mounted.current && !controller.signal.aborted)
        onChange(
          kind === "digital" ? signed.key : signed.publicUrl!,
          duration ? Math.round(duration) : undefined,
        );
    } catch (e) {
      if (mounted.current && !(e instanceof DOMException && e.name === "AbortError"))
        setError(e instanceof Error ? e.message : t("Upload failed.", "Échec de l’envoi."));
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(0);
        onBusy?.(false);
      }
      xhr.current = null;
      abort.current = null;
    }
  }
  return (
    <div className="media-upload">
      <label>
        {label}
        <input
          type="file"
          disabled={busy || disabled}
          accept={
            kind === "image"
              ? ".jpg,.jpeg,.png,.webp,.heic,.heif"
              : kind === "video"
                ? ".mp4,.mov"
                : ".pdf,.epub,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp3,.m4a,.mp4,.mov"
          }
          onChange={(e) => void upload(e.target.files?.[0])}
        />
      </label>
      {value && kind === "image" && safeLink(value) && (
        <img className="upload-preview" src={value} alt={label} />
      )}{" "}
      {value && kind === "video" && safeLink(value) && (
        <video className="upload-video-preview" src={value} controls preload="metadata" />
      )}
      {value && (
        <div className="media-value">
          <span>{t("File added", "Fichier ajouté")}</span>
          <button
            type="button"
            className="text-button"
            disabled={busy || disabled}
            onClick={() => onChange("")}
          >
            {t("Remove", "Retirer")}
          </button>
        </div>
      )}
      {busy && (
        <>
          <progress max={100} value={progress} />
          <span role="status">{progress}%</span>
          <button type="button" className="text-button" onClick={() => abort.current?.abort()}>
            {t("Cancel upload", "Annuler l’envoi")}
          </button>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
