"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Modal } from "./ui";
export function BarcodeScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [manual, setManual] = useState("");
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!camera) return;
    let active = true;
    let stream: MediaStream | undefined;
    let frame = 0;
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) return;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        stream = s;
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current!.srcObject = s;
        await video.current!.play();
        const detector = new Detector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a"],
        });
        const tick = async () => {
          if (!active || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            if (found[0]?.rawValue) {
              onScan(found[0].rawValue);
              return;
            }
          } catch {
            /* A later frame or manual input can still work. */
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
      })
      .catch(() => {
        if (active)
          setError(
            t(
              "Camera unavailable. Enter the code manually.",
              "Caméra indisponible. Saisissez le code manuellement.",
            ),
          );
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, onScan, t]);
  const available =
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!navigator.mediaDevices?.getUserMedia;
  return (
    <Modal title={t("Scan product barcode", "Scanner le code du produit")} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onScan(manual.trim());
        }}
      >
        <label>
          {t("Barcode, QR value or SKU", "Code-barres, valeur QR ou SKU")}
          <input autoFocus value={manual} onChange={(e) => setManual(e.target.value)} required />
        </label>
        <button className="button primary">{t("Find product", "Rechercher le produit")}</button>
      </form>
      {available ? (
        <button className="button secondary camera-start" onClick={() => setCamera(true)}>
          {t("Use camera", "Utiliser la caméra")}
        </button>
      ) : (
        <p className="muted">
          {t(
            "Camera scanning is unavailable in this browser. Use manual entry or a keyboard scanner.",
            "La caméra n’est pas disponible dans ce navigateur. Utilisez la saisie manuelle ou un lecteur clavier.",
          )}
        </p>
      )}
      {camera && <video ref={video} className="scanner-video" muted playsInline />}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
