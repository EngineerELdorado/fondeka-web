"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, ChevronDown, FileText, RefreshCw, Save } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  businessDetailsDraft,
  businessDetailsErrors,
  businessDetailsPatch,
  businessDetailsPath,
  parseBusinessDetails,
  rebaseBusinessDetails,
  replaceBusinessDetails,
  type BusinessDetailsField,
} from "@/lib/business-profile";
import { countryOptions } from "@/lib/payment-country";
import { request } from "@/lib/data";
import { invalidateQueryPaths, queryCacheGeneration } from "@/lib/query-cache";
import type { Business } from "@/lib/types";
import { Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function BusinessDetailsEditor({
  business,
  onClose,
}: {
  business: Business;
  onClose: () => void;
}) {
  const { t, language } = useI18n();
  const { accountKey, notify } = useWorkspace();
  const [baseline, setBaseline] = useState(business);
  const [draft, setDraft] = useState(() => businessDetailsDraft(business));
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<Business>();
  const [checking, setChecking] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const dirty = JSON.stringify(draft) !== JSON.stringify(businessDetailsDraft(baseline));
  const errors = attempted ? businessDetailsErrors(draft) : {};
  const fields: { key: BusinessDetailsField; label: string; max?: number; helper?: string }[] = [
    { key: "name", label: t("Business name", "Nom du Business"), max: 180 },
    { key: "legalName", label: t("Legal name", "Raison sociale"), max: 254 },
    { key: "countryCode", label: t("Country", "Pays") },
    {
      key: "registrationNumber",
      label: t("Registration number", "Numéro d’immatriculation"),
      max: 128,
    },
  ];
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function change(key: BusinessDetailsField, value: string) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setMessage("");
  }
  async function loadLatest() {
    setChecking(true);
    try {
      const value = parseBusinessDetails(
        await request(businessDetailsPath(business.id)),
        business.id,
      );
      if (active.current) {
        setLatest(value);
        setError("");
      }
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : t(
                "Couldn’t refresh Business details.",
                "Impossible d’actualiser les informations Business.",
              ),
        );
    } finally {
      if (active.current) setChecking(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || conflict || !accountKey) return;
    setAttempted(true);
    const validation = businessDetailsErrors(draft);
    if (Object.keys(validation).length) {
      form.current?.querySelector<HTMLElement>(`[name="${Object.keys(validation)[0]}"]`)?.focus();
      return;
    }
    const patch = businessDetailsPatch(baseline, draft);
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    const generation = queryCacheGeneration();
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = parseBusinessDetails(
        await request(businessDetailsPath(business.id), {
          method: "PATCH",
          body: JSON.stringify(patch),
        }),
        business.id,
      );
      if (!active.current) return;
      replaceBusinessDetails(accountKey, saved, generation);
      notify(t("Business details saved.", "Informations Business enregistrées."));
      onClose();
    } catch (failure) {
      if (!active.current) return;
      const status = (failure as { status?: number }).status;
      setError(
        failure instanceof Error
          ? failure.message
          : t(
              "Couldn’t save Business details. Your changes are kept.",
              "Impossible d’enregistrer les informations Business. Vos modifications sont conservées.",
            ),
      );
      if (status === 409) {
        setConflict(true);
        await loadLatest();
      }
      if (status === 404) invalidateQueryPaths(["/customer-api/businesses?"]);
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  function field(key: BusinessDetailsField) {
    const item = fields.find((entry) => entry.key === key)!;
    const errorId = `business-${business.id}-${key}-error`;
    return (
      <label className="business-edit-field" key={key}>
        <span>
          {item.label}
          {key !== "name" && <small>{t("Optional", "Facultatif")}</small>}
        </span>
        {key === "countryCode" ? (
          <span className="header-select business-country-select">
            <select
              name={key}
              value={draft[key]}
              onChange={(event) => change(key, event.target.value)}
              aria-invalid={!!errors[key]}
              aria-describedby={errors[key] ? errorId : undefined}
            >
              <option value="">{t("Not provided", "Non renseigné")}</option>
              {countryOptions(language)
                .filter((country) => country.code !== "XK")
                .map((country) => (
                  <option value={country.code} key={country.code}>
                    {country.flag} {country.name} · {country.code}
                  </option>
                ))}
            </select>
            <span className="switch-chevron" aria-hidden="true">
              <ChevronDown size={14} strokeWidth={2.5} />
            </span>
          </span>
        ) : (
          <input
            name={key}
            value={draft[key]}
            maxLength={item.max}
            required={key === "name"}
            autoComplete="off"
            autoFocus={key === "name"}
            onChange={(event) => change(key, event.target.value)}
            aria-invalid={!!errors[key]}
            aria-describedby={errors[key] ? errorId : undefined}
          />
        )}
        {errors[key] && (
          <small id={errorId} className="form-error" role="alert">
            {errors[key] === "required"
              ? t("Enter a Business name.", "Saisissez un nom de Business.")
              : errors[key] === "country"
                ? t("Select a valid country.", "Choisissez un pays valide.")
                : t(
                    `Use at most ${item.max} characters.`,
                    `Utilisez au maximum ${item.max} caractères.`,
                  )}
          </small>
        )}
      </label>
    );
  }
  return (
    <>
      <form
        className="business-edit-form"
        noValidate
        onSubmit={(event) => void save(event)}
        ref={form}
      >
        <div className="business-edit-heading">
          <span className="tool-icon blue">
            <Building2 size={24} />
          </span>
          <div>
            <h2>{t("Edit Business details", "Modifier les informations Business")}</h2>
            <p>
              {t("Business ID", "Identifiant Business")} : {business.id}
            </p>
          </div>
          {dirty && (
            <span className="business-unsaved" role="status">
              {t("Unsaved changes", "Modifications non enregistrées")}
            </span>
          )}
        </div>
        {conflict && (
          <section className="business-conflict info-box" role="alert">
            <h3>{t("Review the latest details", "Vérifiez les dernières informations")}</h3>
            <p>
              {t(
                "Another update was detected. Your edits are kept. Review the current server values before saving again.",
                "Une autre modification a été détectée. Vos saisies sont conservées. Vérifiez les valeurs actuelles avant de réessayer.",
              )}
            </p>
            {latest && (
              <>
                <dl>
                  {fields.map(({ key, label }) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {businessDetailsDraft(latest)[key] || t("Not provided", "Non renseigné")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || checking}
                  onClick={() => {
                    setDraft(rebaseBusinessDetails(baseline, draft, latest));
                    setBaseline(latest);
                    setConflict(false);
                    setLatest(undefined);
                    setAttempted(false);
                    setError("");
                    setMessage(
                      t(
                        "Your edits have been kept over the latest details. Review them, then save.",
                        "Vos modifications sont conservées sur les dernières informations. Vérifiez-les, puis enregistrez.",
                      ),
                    );
                  }}
                >
                  {t("Review my changes", "Vérifier mes modifications")}
                </button>
              </>
            )}
            {!latest && (
              <button
                className="button secondary"
                type="button"
                disabled={checking}
                onClick={() => void loadLatest()}
              >
                <RefreshCw size={15} />
                {t("Refresh", "Actualiser")}
              </button>
            )}
          </section>
        )}
        <fieldset disabled={busy || conflict}>
          <section className="panel business-edit-section">
            <h3>
              <Building2 size={17} />
              {t("Business identity", "Identité du Business")}
            </h3>
            <div>
              {field("name")}
              {field("legalName")}
              {field("countryCode")}
            </div>
          </section>
          <section className="panel business-edit-section">
            <h3>
              <FileText size={17} />
              {t("Registration", "Immatriculation")}
            </h3>
            <div>{field("registrationNumber")}</div>
          </section>
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="info-box" role="status">
            {message}
          </p>
        )}
        <div className="business-edit-actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={() => (dirty ? setDiscarding(true) : onClose())}
          >
            {t("Cancel", "Annuler")}
          </button>
          <button className="button primary" type="submit" disabled={busy || conflict || !dirty}>
            {busy ? <span className="spinner" /> : <Save size={16} />}
            {busy ? t("Saving…", "Enregistrement…") : t("Save", "Enregistrer")}
          </button>
        </div>
      </form>
      {discarding && (
        <Modal
          title={t("Discard changes?", "Abandonner les modifications ?")}
          onClose={() => setDiscarding(false)}
        >
          <p>
            {t(
              "Your unsaved Business details will be discarded.",
              "Les informations Business non enregistrées seront abandonnées.",
            )}
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setDiscarding(false)}>
              {t("Keep editing", "Continuer la modification")}
            </button>
            <button className="button primary" onClick={onClose}>
              {t("Discard changes", "Abandonner les modifications")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
