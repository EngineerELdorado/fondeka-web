"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Video, FileUp, ImageOff } from "lucide-react";
import { ImageCrop } from "./image-crop";
import { MediaVideo } from "./media-video";
import { request } from "@/lib/data";
import { safeLink } from "@/lib/format";
import { demoMode } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { trainingAssetKey } from "@/lib/training";
import { StorageUploadError, storageUploadCopy, uploadToStorage } from "@/lib/storage-upload";
interface Presign {
  url: string;
  method: string;
  headers: Record<string, string>;
  publicUrl?: string | null;
  key: string;
  maxBytes: number;
}
export function MediaUpload({
  label,
  value,
  onChange,
  scope,
  storeId,
  productId,
  kind = "image",
  maxBytes,
  maxSeconds = 30,
  onBusy,
  disabled = false,
  aspect,
  duration: savedDuration,
  helper,
  ownerName,
  compact = false,
}: {
  label: string;
  value?: string | null;
  onChange: (url: string, duration?: number, fileName?: string) => void;
  scope: string;
  storeId?: number;
  productId?: number;
  kind?: "image" | "video" | "digital" | "training";
  maxBytes?: number;
  maxSeconds?: number;
  onBusy?: (busy: boolean) => void;
  disabled?: boolean;
  aspect?: number;
  duration?: number | null;
  helper?: string;
  ownerName?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const privateFile = kind === "digital" || kind === "training";
  const videoLimit = Math.min(maxSeconds, 30);
  const mediaName = ownerName ? `${ownerName} · ${label}` : label;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [crop, setCrop] = useState<File>();
  const [preview, setPreview] = useState<File>();
  const input = useRef<HTMLInputElement>(null);

  const abort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);
  function select(file?: File) {
    if (!file || busy || disabled || crop) return;
    setError("");
    if (kind === "image" && aspect) {
      if (
        !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) ||
        file.size <= 0 ||
        file.size > (maxBytes ?? 10 * 1024 * 1024)
      ) {
        setError(
          t(
            "Choose a photo up to 10 MB (JPG, PNG or WebP).",
            "Choisissez une photo de 10 Mo maximum (JPG, PNG ou WebP).",
          ),
        );
        return;
      }
      setCrop(file);
      onBusy?.(true);
    } else void upload(file);
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setError("");
    setBusy(true);
    setPreview(file);
    onBusy?.(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const accepted =
        kind === "training"
          ? [
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
              "jpg",
              "jpeg",
              "png",
              "webp",
            ]
          : kind === "image"
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
        (kind === "image" ? 10 * 1024 * 1024 : privateFile ? 250 * 1024 * 1024 : 50 * 1024 * 1024);
      if (file.size <= 0 || file.size > localCap)
        throw new Error(
          t("This file is too large or empty.", "Ce fichier est trop volumineux ou vide."),
        );
      let duration: number | undefined;
      if (kind === "video") {
        const url = URL.createObjectURL(file);
        try {
          duration = await new Promise<number | undefined>((resolve, reject) => {
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
              resolve(undefined);
            };
            const timer = setTimeout(fail, 15000);
            controller.signal.addEventListener("abort", cancel, { once: true });
            video.preload = "metadata";
            video.onloadedmetadata = () => {
              const seconds = video.duration;
              cleanup();
              resolve(Number.isFinite(seconds) && seconds > 0 ? seconds : undefined);
            };
            video.onerror = fail;
            video.src = url;
          });
        } finally {
          URL.revokeObjectURL(url);
        }
        if (duration !== undefined && duration > Math.min(maxSeconds, 30))
          throw new Error(
            t(
              `Choose a video of ${Math.min(maxSeconds, 30)} seconds or less.`,
              `Choisissez une vidéo de ${Math.min(maxSeconds, 30)} secondes maximum.`,
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
        (kind === "training" ? file.type || "application/octet-stream" : "") ||
        (file.type && file.type !== "application/octet-stream" ? file.type : "") ||
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
            epub: "application/epub+zip",
            txt: "text/plain",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ppt: "application/vnd.ms-powerpoint",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            mp3: "audio/mpeg",
            m4a: "audio/mp4",
          } as Record<string, string>
        )[ext] ||
        "application/octet-stream";
      const endpoint =
        kind === "training"
          ? `/customer-api/commerce/products/${productId}/training/assets/presign`
          : kind === "digital"
            ? `/customer-api/commerce/stores/${storeId}/products/digital-assets/presign`
            : "/customer-api/storage/presign";
      const signed = await request<Presign>(endpoint, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify(
          kind === "training" ? { contentType, ext } : { scope, storeId, contentType, ext },
        ),
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
        (signed.method || "PUT") !== "PUT" ||
        (privateFile ? !signed.key : !signed.publicUrl || !safeLink(signed.publicUrl)) ||
        (kind === "training" &&
          (signed.publicUrl != null ||
            !trainingAssetKey.test(signed.key) ||
            !Number.isFinite(signed.maxBytes) ||
            signed.maxBytes <= 0))
      )
        throw new Error(
          t("The upload destination is invalid.", "La destination d’envoi est invalide."),
        );
      await uploadToStorage(signed, file, {
        contentType,
        signal: controller.signal,
        onProgress: (percentage) => {
          if (mounted.current) setProgress(percentage);
        },
      });
      if (mounted.current && !controller.signal.aborted)
        onChange(
          privateFile ? signed.key : signed.publicUrl!,
          duration ? Math.round(duration) : undefined,
          file.name,
        );
    } catch (e) {
      if (mounted.current && !(e instanceof DOMException && e.name === "AbortError")) {
        if (e instanceof StorageUploadError) {
          const [en, fr] = storageUploadCopy(e);
          const details = [
            e.status ? `HTTP ${e.status}` : "",
            e.code,
            e.requestId ? `${t("Support reference", "Référence support")} : ${e.requestId}` : "",
          ]
            .filter(Boolean)
            .join(" · ");
          setError(`${t(en, fr)} ${details}`);
        } else setError(e instanceof Error ? e.message : t("Upload failed.", "Échec de l’envoi."));
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(0);
        setPreview(undefined);
        onBusy?.(false);
      }
      abort.current = null;
    }
  }
  return (
    <div
      className={`media-upload media-upload-${kind} ${aspect && aspect !== 1 ? "media-upload-wide" : ""}`}
      onDragOver={(e) => {
        if (kind === "image") e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (kind === "image") select(e.dataTransfer.files[0]);
      }}
    >
      <strong className="media-upload-label">{label}</strong>
      {kind === "image" && (
        <div className="media-upload-frame" style={{ aspectRatio: aspect || 1 }}>
          {value && safeLink(value) ? (
            <ImagePreview key={value} value={value} label={mediaName} />
          ) : (
            <ImagePlus size={30} strokeWidth={1.4} aria-hidden="true" />
          )}
        </div>
      )}
      {value && kind === "video" && (
        <MediaVideo url={value} title={mediaName} duration={savedDuration} />
      )}
      {!value && kind === "video" && (
        <Video className="media-upload-icon" size={28} strokeWidth={1.4} aria-hidden="true" />
      )}
      {privateFile && <FileUp size={25} aria-hidden="true" />}
      <input
        ref={input}
        className="sr-only"
        aria-label={label}
        type="file"
        disabled={busy || disabled || !!crop}
        accept={
          kind === "image"
            ? ".jpg,.jpeg,.png,.webp,.heic,.heif"
            : kind === "video"
              ? ".mp4,.mov"
              : kind === "training"
                ? ".pdf,.epub,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp3,.m4a,.mp4,.mov,.jpg,.jpeg,.png,.webp"
                : ".pdf,.epub,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp3,.m4a,.mp4,.mov"
        }
        onChange={(e) => {
          select(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <p className="media-upload-helper">
        {helper ||
          (kind === "video"
            ? t(
                `Optional · A short explanation, up to ${videoLimit} seconds. MP4 or MOV.`,
                `Facultatif · Une courte présentation, jusqu’à ${videoLimit} secondes. MP4 ou MOV.`,
              )
            : kind === "image"
              ? t("Choose a photo or drop it here.", "Choisissez une photo ou glissez-la ici.")
              : "")}
      </p>
      <div className="media-upload-actions">
        <button
          type="button"
          className="button secondary"
          disabled={busy || disabled || !!crop}
          onClick={() => input.current?.click()}
          aria-label={`${value ? t("Replace", "Remplacer") : t("Upload", "Importer")} · ${label}`}
        >
          {kind === "video"
            ? value
              ? t("Replace video", "Remplacer la vidéo")
              : t("Add video", "Ajouter une vidéo")
            : value
              ? t("Replace", "Remplacer")
              : kind === "image"
                ? compact
                  ? t("Add", "Ajouter")
                  : t("Upload photo", "Importer une photo")
                : t("Choose file", "Choisir un fichier")}
        </button>
        {value && (
          <button
            type="button"
            className="text-button"
            disabled={busy || disabled || !!crop}
            onClick={() => onChange("")}
            aria-label={`${t("Remove", "Retirer")} · ${label}`}
          >
            {t("Remove", "Retirer")}
          </button>
        )}
      </div>
      {privateFile && value && <span className="muted">{t("File added", "Fichier ajouté")}</span>}
      {busy && (
        <div className="media-upload-progress">
          <span role="status">
            {t("Uploading…", "Envoi en cours…")} {preview?.name}
          </span>
          <progress
            max={100}
            value={progress}
            aria-label={t("Upload progress", "Progression de l’envoi")}
          />
          <span aria-hidden="true">{progress}%</span>
          <button type="button" className="text-button" onClick={() => abort.current?.abort()}>
            {t("Cancel upload", "Annuler l’envoi")}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {crop && (
        <ImageCrop
          file={crop}
          aspect={aspect || 1}
          onCancel={() => {
            setCrop(undefined);
            onBusy?.(false);
          }}
          onConfirm={(photo) => {
            setCrop(undefined);
            void upload(photo);
          }}
        />
      )}
    </div>
  );
}

function ImagePreview({ value, label }: { value: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <ImageOff size={30} aria-label={label} />
  ) : (
    <img src={value} alt={label} loading="lazy" onError={() => setFailed(true)} />
  );
}
