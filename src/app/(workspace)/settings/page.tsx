"use client";

import { useState } from "react";
import { FlaskConical, RotateCcw, Settings2 } from "lucide-react";
import { Modal, PageHeading } from "@/components/ui";
import { BusinessSettings } from "@/components/business-settings";
import { useWorkspace } from "@/components/workspace-provider";
import { demoMode } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { resetDemo } from "@/lib/demo";

export default function Settings() {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const { refresh, notify } = useWorkspace();
  return (
    <>
      <PageHeading
        icon={Settings2}
        title={t("Settings", "Paramètres")}
        description={t(
          "Your business identity and registration details.",
          "L’identité et les informations d’immatriculation de votre Business.",
        )}
      />
      <BusinessSettings />
      {demoMode && (
        <details className="panel settings-demo-panel">
          <summary>
            <FlaskConical size={18} />
            {t("Demo workspace", "Espace de démonstration")}
          </summary>
          <div>
            <p>
              {t(
                "Reset the fictional data in this browser to start fresh.",
                "Réinitialisez les données fictives de ce navigateur pour repartir de zéro.",
              )}
            </p>
            <button type="button" className="button secondary" onClick={() => setConfirming(true)}>
              <RotateCcw size={16} />
              {t("Reset demo data", "Réinitialiser les données de démonstration")}
            </button>
          </div>
        </details>
      )}
      {confirming && (
        <Modal
          title={t("Start fresh?", "Repartir de zéro ?")}
          description={t(
            "This resets fictional stores, products, payment requests, and sales saved in this browser.",
            "Cette action réinitialise les boutiques, produits, demandes de paiement et ventes fictifs enregistrés dans ce navigateur.",
          )}
          onClose={() => setConfirming(false)}
        >
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setConfirming(false)}>
              {t("Keep exploring", "Continuer à explorer")}
            </button>
            <button
              className="button primary"
              onClick={() => {
                resetDemo();
                refresh();
                notify(t("Demo workspace reset.", "Espace de démonstration réinitialisé."));
                setConfirming(false);
              }}
            >
              {t("Reset demo", "Réinitialiser la démonstration")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
