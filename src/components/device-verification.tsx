"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";
import { checkBrowserApproval, registerBrowser } from "@/lib/device";
import { Brand } from "./ui";
import { ThemeToggle } from "./theme-toggle";

export function DeviceVerification({
  onVerified,
  onLogout,
}: {
  onVerified: () => void;
  onLogout: () => void;
}) {
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const started = useRef(false);
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
      setError(error instanceof Error ? error.message : "Device verification failed.");
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
          "Approval is still pending. Open the Fondeka app on your trusted device to approve this browser.",
        );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Couldn’t check approval.");
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
        <h1>Verify this browser</h1>
        <p className="muted">
          Keep your business in trusted hands. Fondeka needs to verify this device before opening
          your workspace.
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
            <>
              <span className="spinner" /> Verifying…
            </>
          ) : (
            <>
              <ShieldCheck size={17} />
              {pending ? "I’ve approved this browser" : "Try verification again"}
            </>
          )}
        </button>
        <button className="text-button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </main>
  );
}
