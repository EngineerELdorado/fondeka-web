"use client";
import { useRef, useState, type FormEvent } from "react";
import { Clock3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { uiText } from "@/lib/ui-copy";
import { request } from "@/lib/data";
import { correctionPolicyInput, hasPosFeature, type CorrectionPolicy } from "@/lib/pos-management";
import { canManageStore } from "@/lib/commerce";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Store } from "@/lib/types";
import { SubmitButton } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function StorePosPolicy({ store }: { store: Store }) {
  const { t } = useI18n();
  const { notify, refresh } = useWorkspace();
  const [policy, setPolicy] = useState(store.posCorrectionPolicy);
  const [staff, setStaff] = useState(String(policy?.staffWindowHours ?? 24));
  const [owner, setOwner] = useState(String(policy?.ownerWindowHours ?? 168));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const available =
    canManageStore(store, "canManageStore") && hasPosFeature(store, "correctionPolicy") && !!policy;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!available || lock.current) return;
    setError("");
    try {
      const body = correctionPolicyInput(staff, owner, policy!.version);
      lock.current = true;
      setBusy(true);
      const value = await request<CorrectionPolicy>(
        `/customer-api/commerce/stores/${store.id}/pos/correction-policy`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (
        !Number.isSafeInteger(value?.version) ||
        value.version <= body.version ||
        value.staffWindowHours !== body.staffWindowHours ||
        value.ownerWindowHours !== body.ownerWindowHours
      )
        throw new Error(
          t(
            "The settings could not be confirmed. Refresh before saving again.",
            "Les paramètres n’ont pas pu être confirmés. Actualisez avant de réessayer.",
          ),
        );
      setPolicy(value);
      invalidateQueryPaths([`/customer-api/commerce/stores/${store.id}`]);
      refresh();
      notify(t("Correction windows saved.", "Délais de correction enregistrés."));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? uiText(failure.message)
          : t("Unable to save settings.", "Impossible d’enregistrer les paramètres."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="pos-policy-card">
      <div className="pos-section-title">
        <Clock3 size={21} />
        <div>
          <h3>{t("Sale correction windows", "Délais de correction des ventes")}</h3>
          <p className="muted small">
            {t(
              "Choose how long your team and you can correct or delete a sale.",
              "Choisissez pendant combien de temps votre équipe et vous pouvez corriger ou supprimer une vente.",
            )}
          </p>
        </div>
      </div>
      <form onSubmit={save} className="form-stack">
        <fieldset disabled={!available || busy} className="form-grid sale-update-fields">
          <label>
            {t("Staff window (hours)", "Délai équipe (heures)")}
            <input
              type="number"
              min="0"
              max="8760"
              step="1"
              value={staff}
              onChange={(e) => setStaff(e.target.value)}
              required
            />
            <small className="muted">
              {t("For example: 24 hours = 1 day", "Par exemple : 24 heures = 1 jour")}
            </small>
          </label>
          <label>
            {t("Owner window (hours)", "Délai propriétaire (heures)")}
            <input
              type="number"
              min="0"
              max="8760"
              step="1"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              required
            />
            <small className="muted">
              {t("For example: 168 hours = 7 days", "Par exemple : 168 heures = 7 jours")}
            </small>
          </label>
        </fieldset>
        <p className="muted small">
          {t(
            "Windows start when the sale is created. Use 0 to disable corrections for that role. The owner window must cover the staff window. Later payment entries follow the outstanding balance independently.",
            "Les délais commencent à la création de la vente. Utilisez 0 pour désactiver les corrections pour ce rôle. Le délai propriétaire doit couvrir celui de l’équipe. Les paiements ultérieurs restent liés au solde dû, indépendamment de ces délais.",
          )}
        </p>
        {!available && (
          <p className="info-box">
            {t(
              "Configurable correction windows are not available for this store yet. The values shown are suggested defaults.",
              "Les délais configurables ne sont pas encore disponibles pour cette boutique. Les valeurs affichées sont des suggestions.",
            )}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div>
          <SubmitButton busy={busy} disabled={!available}>
            {t("Save correction windows", "Enregistrer les délais")}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
