"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Modal } from "./ui";

export function ImageCrop({
  file,
  aspect,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect: number;
  onCancel: () => void;
  onConfirm: (file: File) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement>();
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const source = URL.createObjectURL(file);
    const picture = new Image();
    picture.onload = () => setImage(picture);
    picture.onerror = () =>
      setError(
        t(
          "This image cannot be read. Choose another photo.",
          "Cette image ne peut pas être lue. Choisissez une autre photo.",
        ),
      );
    picture.src = source;
    return () => {
      picture.onload = null;
      picture.onerror = null;
      URL.revokeObjectURL(source);
    };
  }, [file, t]);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context || !image) return;
    const scale =
      Math.max(surface.width / image.naturalWidth, surface.height / image.naturalHeight) * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, surface.width, surface.height);
    context.drawImage(
      image,
      ((surface.width - width) * x) / 100,
      ((surface.height - height) * y) / 100,
      width,
      height,
    );
  }, [image, zoom, x, y]);
  function confirm() {
    setBusy(true);
    canvas.current?.toBlob(
      (blob) => {
        if (blob) onConfirm(new File([blob], "photo.jpg", { type: "image/jpeg" }));
        else {
          setBusy(false);
          setError(t("Could not prepare this image.", "Impossible de préparer cette image."));
        }
      },
      "image/jpeg",
      0.9,
    );
  }
  return (
    <Modal
      title={t("Adjust photo", "Ajuster la photo")}
      onClose={onCancel}
      busy={busy}
      className="image-crop-dialog"
    >
      <p className="muted">
        {t(
          "Zoom and reposition your photo before uploading.",
          "Zoomez et repositionnez votre photo avant l’envoi.",
        )}
      </p>
      <canvas
        ref={canvas}
        width={aspect === 1 ? 1024 : 1600}
        height={Math.round((aspect === 1 ? 1024 : 1600) / aspect)}
        className="image-crop-canvas"
        aria-label={t("Photo crop preview", "Aperçu du recadrage")}
      />
      {!image && !error && <p role="status">{t("Preparing photo…", "Préparation de la photo…")}</p>}
      <div className="image-crop-controls">
        <label>
          {t("Zoom", "Zoom")}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={!image || busy}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          {t("Horizontal position", "Position horizontale")}
          <input
            type="range"
            min={0}
            max={100}
            value={x}
            disabled={!image || busy}
            onChange={(e) => setX(Number(e.target.value))}
          />
        </label>
        <label>
          {t("Vertical position", "Position verticale")}
          <input
            type="range"
            min={0}
            max={100}
            value={y}
            disabled={!image || busy}
            onChange={(e) => setY(Number(e.target.value))}
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
          {t("Cancel", "Annuler")}
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!image || !!error || busy}
          onClick={confirm}
        >
          {t("Use photo", "Utiliser la photo")}
        </button>
      </div>
    </Modal>
  );
}
