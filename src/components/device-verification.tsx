"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";
import { checkBrowserApproval, registerBrowser } from "@/lib/device";
import { useI18n } from "@/lib/i18n";
import { useUiText } from "@/lib/use-ui-text";
import { Brand } from "./ui";
import { ThemeToggle } from "./theme-toggle";

export function DeviceVerification({
  onVerified,
  onLogout,
}: {
  onVerified: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const uiText = useUiText();
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);
  const explain = (failure: unknown, fallback: string) => {
    const detail = failure as { name?: unknown; message?: unknown } | null;
    if (detail?.name === "SecurityError" || detail?.name === "QuotaExceededError")
      return t(
        "Browser storage is unavailable. Allow site storage and try verification again.",
        "Le stockage du navigateur est indisponible. Autorisez le stockage du site, puis réessayez la vérification.",
      );
    return typeof detail?.message === "string" && detail.message.trim()
      ? uiText(detail.message)
      : fallback;
  };
  async function register() {
    setBusy(true);
    setError("");
    try {
      const result = await registerBrowser();
      if (result.verified) onVerified();
      else {
        setPending(true);
        setMessage(result.message);
      }
    } catch (error) {
      setError(
        explain(
          error,
          t(
            "Device verification failed. Please try again.",
            "La vérification du navigateur a échoué. Veuillez réessayer.",
          ),
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      void register();
    }
  });
  async function check() {
    setBusy(true);
    setError("");
    try {
      if (await checkBrowserApproval()) onVerified();
      else
        setMessage(
          t(
            "Approval is still pending. Open the Fondeka app on your trusted device to approve this browser.",
            "L’approbation est toujours en attente. Ouvrez l’application Fondeka sur votre appareil de confiance pour approuver ce navigateur.",
          ),
        );
    } catch (error) {
      setError(
        explain(error, t("Couldn’t check approval.", "Impossible de vérifier l’approbation.")),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="verification-screen">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <Brand />
      <div className="verification-card">
        <span className="empty-icon">
          <Smartphone size={28} />
        </span>
        <h1>{t("Verify this browser", "Vérifiez ce navigateur")}</h1>
        <p className="muted">
          {t(
            "Keep your business in trusted hands. Fondeka needs to verify this device before opening your workspace.",
            "Protégez votre activité. Fondeka doit vérifier ce navigateur avant d’ouvrir votre espace.",
          )}
        </p>
        {message && <div className="info-box">{message}</div>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void (pending ? check() : register())}
        >
          {busy ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <ShieldCheck size={17} aria-hidden="true" />
          )}
          {/* Translators may replace text nodes; keep the label inside a stable element. */}
          <span>
            {busy
              ? t("Verifying…", "Vérification…")
              : pending
                ? t("I’ve approved this browser", "J’ai approuvé ce navigateur")
                : t("Try verification again", "Réessayer la vérification")}
          </span>
        </button>
        <button className="text-button" onClick={onLogout}>
          <span>{t("Sign out", "Se déconnecter")}</span>
        </button>
      </div>
    </main>
  );
}
