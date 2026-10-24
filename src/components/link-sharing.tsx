"use client";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Share2, Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useI18n } from "@/lib/i18n";
import { escapeHtml } from "@/lib/receipt";
import { safeLink } from "@/lib/format";
import { useWorkspace } from "./workspace-provider";
export function LinkSharing({
  url,
  title,
  showQr = false,
}: {
  url?: string;
  title: string;
  showQr?: boolean;
}) {
  const { t } = useI18n();
  const { notify } = useWorkspace();
  const link = safeLink(url);
  const [qr, setQr] = useState<{ link: string; image: string }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (link)
      void QRCode.toDataURL(link, { width: 600, margin: 3, errorCorrectionLevel: "M" }).then(
        (image) => {
          if (active) setQr({ link, image });
        },
        () => {
          if (active)
            setError(t("QR code could not be generated.", "Impossible de générer le code QR."));
        },
      );
    return () => {
      active = false;
    };
  }, [link, t]);
  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      notify(t("Link copied.", "Lien copié."));
    } catch {
      notify(t("Select the link to copy it.", "Sélectionnez le lien pour le copier."));
    }
  }
  async function share() {
    if (!link) return;
    try {
      if (navigator.share) await navigator.share({ title, url: link });
      else await copy();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }
  function print() {
    if (!qr || qr.link !== link) return;
    const win = window.open("", "_blank", "width=700,height=800");
    if (!win) {
      notify(t("Allow popups to print.", "Autorisez les fenêtres contextuelles pour imprimer."));
      return;
    }
    win.opener = null;
    win.document.write(
      `<!doctype html><html><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{text-align:center;font:18px system-ui;padding:40px}img{width:300px;max-width:90%}p{overflow-wrap:anywhere}</style><h1>${escapeHtml(title)}</h1><img src="${qr.image}" alt="QR"><p>${escapeHtml(link)}</p></html>`,
    );
    win.document.close();
    const image = win.document.querySelector("img");
    if (image?.complete) win.print();
    else image?.addEventListener("load", () => win.print(), { once: true });
  }

  if (!link)
    return (
      <p className="muted">
        {t("The public link is not available yet.", "Le lien public n’est pas encore disponible.")}
      </p>
    );
  return (
    <div className="share-panel">
      <div className="copy-field">
        <code>{link}</code>
        <button
          className="icon-button"
          aria-label={t("Copy link", "Copier le lien")}
          onClick={() => void copy()}
        >
          <Copy size={18} />
        </button>
      </div>
      <div className="parity-actions">
        <a className="button secondary small" href={link} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} />
          {t("Open link", "Ouvrir le lien")}
        </a>
        <button className="button secondary small" onClick={() => void share()}>
          <Share2 size={16} />
          {t("Share", "Partager")}
        </button>
      </div>
      {qr?.link === link && (
        <details open={showQr}>
          <summary>{t("QR code", "Code QR")}</summary>
          <div className="qr-print">
            <h3>{title}</h3>
            <img
              src={qr.image}
              alt={t(
                "Scan to open the payment or store link",
                "Scanner pour ouvrir le lien de paiement ou la boutique",
              )}
              width={220}
              height={220}
            />
            <p>{link}</p>
          </div>
          <div className="parity-actions">
            <a className="button secondary small" download="fondeka-qr.png" href={qr.image}>
              <Download size={15} />
              {t("Download", "Télécharger")}
            </a>
            <button className="button secondary small" onClick={print}>
              <Printer size={15} />
              {t("Print", "Imprimer")}
            </button>
          </div>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
