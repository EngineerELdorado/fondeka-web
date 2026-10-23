"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Smartphone } from "lucide-react";
import { appStoreUrl, playStoreUrl, registrationStore } from "@/lib/app-stores";
import { useI18n } from "@/lib/i18n";
import { Modal } from "./ui";

export function AppRegistration({ disabled = false }: { disabled?: boolean }) {
  const { t } = useI18n();
  const [storeUrl, setStoreUrl] = useState<string>();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setStoreUrl(registrationStore(navigator));
  }, []);
  return (
    <>
      <div className="login-register">
        <p>
          {t("New to Fondeka?", "Vous découvrez Fondeka ?")}{" "}
          {storeUrl ? (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-button"
              aria-disabled={disabled}
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
            >
              {t("Register", "S’inscrire")}
              <ArrowUpRight size={15} />
            </a>
          ) : (
            <button
              type="button"
              className="text-button"
              disabled={disabled}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              {t("Register", "S’inscrire")}
              <ArrowUpRight size={15} />
            </button>
          )}
        </p>
        <small>
          {t(
            "Create your account in the Fondeka app.",
            "Créez votre compte dans l’application Fondeka.",
          )}
        </small>
      </div>
      {open && <AppRegistrationDialog onClose={() => setOpen(false)} />}
    </>
  );
}
function AppRegistrationDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [codes, setCodes] = useState<{ apple: string; google: string }>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void import("qrcode")
      .then(async ({ default: qr }) => {
        const options = { width: 384, margin: 3, errorCorrectionLevel: "M" as const };
        const [apple, google] = await Promise.all([
          qr.toDataURL(appStoreUrl, options),
          qr.toDataURL(playStoreUrl, options),
        ]);
        if (active) setCodes({ apple, google });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <Modal
      title={t("Register in the Fondeka app", "Inscrivez-vous dans l’application Fondeka")}
      description={t(
        "Scan with your phone to download the app and create your account. Then sign in here with the same email.",
        "Scannez avec votre téléphone pour télécharger l’application et créer votre compte. Connectez-vous ensuite ici avec le même e-mail.",
      )}
      onClose={onClose}
      className="registration-dialog"
    >
      <div className="registration-stores">
        {(
          [
            { id: "apple", name: "App Store", platform: "iPhone / iPad", url: appStoreUrl },
            { id: "google", name: "Google Play", platform: "Android", url: playStoreUrl },
          ] as const
        ).map((store) => (
          <a
            key={store.id}
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className="registration-store"
            aria-label={t("Download Fondeka from ", "Télécharger Fondeka sur ") + store.name}
          >
            <div className="registration-qr">
              {codes ? (
                <img
                  width={192}
                  height={192}
                  src={codes[store.id]}
                  alt={
                    t("Scan to download Fondeka from ", "Scannez pour télécharger Fondeka sur ") +
                    store.name
                  }
                />
              ) : (
                <span role="status">
                  {failed ? (
                    <Smartphone size={32} />
                  ) : (
                    t("Preparing QR code…", "Préparation du code QR…")
                  )}
                </span>
              )}
            </div>
            <strong>
              {store.name}
              <ArrowUpRight size={15} />
            </strong>
            <small>{store.platform}</small>
          </a>
        ))}
      </div>
      {failed && (
        <div className="registration-qr-error" role="alert">
          <p>
            {t(
              "Use the store links above, or try the QR codes again.",
              "Utilisez les liens ci-dessus ou réessayez les codes QR.",
            )}
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {t("Retry QR codes", "Réessayer les codes QR")}
          </button>
        </div>
      )}
      <button className="button secondary full-width" type="button" onClick={onClose}>
        {t("Back to sign in", "Retour à la connexion")}
      </button>
    </Modal>
  );
}
