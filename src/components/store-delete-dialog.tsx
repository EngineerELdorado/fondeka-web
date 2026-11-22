"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { uiText } from "@/lib/ui-copy";
import { request } from "@/lib/data";
import { canManageStore } from "@/lib/commerce";
import { hasPosFeature, type DeletionChallenge } from "@/lib/pos-management";
import type { Store } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";

export function StoreDeleteDialog({
  store,
  onClose,
  onDeleted,
}: {
  store: Store;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [challenge, setChallenge] = useState<DeletionChallenge>();
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false);
  const available =
    canManageStore(store, "canManageStore") && hasPosFeature(store, "emailDeletion");
  const expired = !!challenge && Date.parse(challenge.expiresAt) <= now;
  const resendSeconds = Math.max(
    0,
    Math.ceil((Date.parse(challenge?.resendAfter || "") - now) / 1000) || 0,
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function send() {
    if (!available || lock.current || resendSeconds > 0) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await request<DeletionChallenge>(
        `/customer-api/commerce/stores/${store.id}/deletion-challenges`,
        { method: "POST", body: "{}" },
      );
      if (
        !value?.challengeId ||
        value.storeId !== store.id ||
        !value.maskedEmail ||
        !Number.isFinite(Date.parse(value.expiresAt)) ||
        Date.parse(value.expiresAt) <= Date.now() ||
        !Number.isFinite(Date.parse(value.resendAfter))
      )
        throw new Error(
          t(
            "The verification request could not be confirmed. Try again later.",
            "La demande de vérification n’a pas pu être confirmée. Réessayez plus tard.",
          ),
        );
      setChallenge(value);
      setCode("");
      setNow(Date.now());
    } catch (failure) {
      setError(
        failure instanceof Error
          ? uiText(failure.message)
          : t("Unable to send the code.", "Impossible d’envoyer le code."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(event: FormEvent) {
    event.preventDefault();
    if (
      !available ||
      !challenge ||
      expired ||
      lock.current ||
      !confirmation ||
      !/^\d{6}$/.test(code)
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      // No fallback to the old, unverified DELETE endpoint. The server consumes a store-bound OTP atomically.
      const result = await request<{ storeId: number; deleted: boolean }>(
        `/customer-api/commerce/stores/${store.id}/deletion-confirmations`,
        { method: "POST", body: JSON.stringify({ challengeId: challenge.challengeId, code }) },
      );
      if (result?.storeId !== store.id || result.deleted !== true)
        throw new Error(
          t(
            "Deletion could not be confirmed. Refresh the store before trying again.",
            "La suppression n’a pas pu être confirmée. Actualisez la boutique avant de réessayer.",
          ),
        );
      setCode("");
      onDeleted();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? uiText(failure.message)
          : t(
              "Deletion could not be confirmed. Refresh the store before trying again.",
              "La suppression n’a pas pu être confirmée. Actualisez la boutique avant de réessayer.",
            ),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t("Delete store", "Supprimer la boutique")}
      description={store.name}
      onClose={onClose}
      busy={busy}
    >
      <form className="form-stack" onSubmit={remove}>
        <div className="pos-section-title">
          <ShieldCheck size={27} />
          <p>
            {t(
              "Confirm with the code sent to the store owner’s verified account email.",
              "Confirmez avec le code envoyé à l’adresse e-mail vérifiée du compte propriétaire.",
            )}
          </p>
        </div>
        <p className="muted">
          {t(
            "After deletion, this store will no longer be available to customers or your team.",
            "Après suppression, cette boutique ne sera plus accessible aux clients ni à votre équipe.",
          )}
        </p>
        {!available ? (
          <p className="info-box">
            {t(
              "Email-confirmed deletion is not available for this store yet. Contact support to delete it.",
              "La suppression confirmée par e-mail n’est pas encore disponible. Contactez l’assistance pour supprimer cette boutique.",
            )}
          </p>
        ) : (
          <>
            {challenge && (
              <>
                <p role="status">
                  {t("Code sent to ", "Code envoyé à ")}
                  <strong>{challenge.maskedEmail}</strong>
                </p>
                <label>
                  {t("6-digit email code", "Code e-mail à 6 chiffres")}
                  <input
                    data-autofocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    disabled={busy || expired}
                  />
                </label>
                {expired && (
                  <p className="form-error" role="alert">
                    {t(
                      "This code expired. Request a new one.",
                      "Ce code a expiré. Demandez-en un nouveau.",
                    )}
                  </p>
                )}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmation}
                    onChange={(e) => setConfirmation(e.target.checked)}
                    disabled={busy}
                  />
                  {t(
                    "I understand this will delete the store.",
                    "Je comprends que la boutique sera supprimée.",
                  )}
                </label>
              </>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={busy || resendSeconds > 0}
              onClick={() => void send()}
            >
              <Mail size={17} />
              {challenge
                ? resendSeconds
                  ? t(`Resend in ${resendSeconds}s`, `Renvoyer dans ${resendSeconds}s`)
                  : t("Resend code", "Renvoyer le code")
                : t("Send verification code", "Envoyer le code")}
            </button>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            {t("Cancel", "Annuler")}
          </button>
          <SubmitButton
            busy={busy}
            disabled={!available || !challenge || expired || !confirmation || !/^\d{6}$/.test(code)}
          >
            {t("Verify and delete store", "Vérifier et supprimer")}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
