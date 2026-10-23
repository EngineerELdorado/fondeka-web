"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCurrencies } from "@/lib/use-currencies";
import { useQuery } from "@/lib/use-query";
import { useI18n } from "@/lib/i18n";
import { label } from "@/lib/format";
import { request } from "@/lib/data";
import { managedVideoCleanupCandidates } from "@/lib/media";
import { storeEditInput } from "@/lib/commerce";
import { invalidateQueryPaths } from "@/lib/query-cache";
import type { Store, StoreInput } from "@/lib/types";
import { Modal, SubmitButton } from "./ui";
import { MediaUpload } from "./media-upload";
import { StoreCreateFlow } from "./store-create-flow";
import { useWorkspace } from "./workspace-provider";
export function StoreForm(props: { store?: Store; onClose: () => void; forPos?: boolean }) {
  return props.store ? (
    <StoreEditor {...props} />
  ) : (
    <StoreCreateFlow onClose={props.onClose} forPos={props.forPos} />
  );
}
function StoreEditor({ store, onClose }: { store?: Store; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const { notify } = useWorkspace();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const account = useQuery<{ defaultFiatCurrency?: string; countryCode?: string }>(
    store ? null : "/customer-api/accounts/my-account",
  );
  const [form, setForm] = useState<StoreInput>({
    name: store?.name || "",
    description: store?.description || "",
    defaultCurrency: store?.defaultCurrency || "",
    reportCurrency: store?.reportCurrency || store?.defaultCurrency || "",
    countryCode: store?.countryCode || "",
    slug: store?.slug || "",
    contactEmail: store?.contactEmail || "",
    whatsappNumber: store?.whatsappNumber || "",
    logoUrl: store?.logoUrl || null,
    bannerUrl: store?.bannerUrl || null,
    videoUrl: store?.videoUrl || null,
    videoDurationSeconds: store?.videoDurationSeconds || null,
    facebookUrl: store?.facebookUrl || "",
    instagramUrl: store?.instagramUrl || "",
    youtubeUrl: store?.youtubeUrl || "",
    linkedinUrl: store?.linkedinUrl || "",
    twitterUrl: store?.twitterUrl || "",
    tiktokUrl: store?.tiktokUrl || "",
    status: store?.status || "ACTIVE",
    visibility: store?.visibility || "PUBLIC",
  });
  const defaultCurrency = form.defaultCurrency || account.data?.defaultFiatCurrency || "USD";
  const countryCode = form.countryCode || account.data?.countryCode || "";
  const { currencies } = useCurrencies([defaultCurrency, form.reportCurrency || defaultCurrency]);
  const set = (key: keyof StoreInput, value: unknown) => setForm((f) => ({ ...f, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lock.current || uploading) return;
    setError("");
    if (!form.name.trim()) {
      setError(t("Enter a store name.", "Saisissez un nom de boutique."));
      return;
    }
    if ((store || step > 0) && !form.description.trim()) {
      setError(t("Explain what your business does.", "Expliquez l’activité de votre entreprise."));
      return;
    }
    if (!store && step < 2) {
      setStep((s) => s + 1);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const current = store
        ? await request<Store>("/customer-api/commerce/stores/" + store.id)
        : undefined;
      const saved = await request<Store>(
        `/customer-api/commerce/stores${store ? `/${store.id}` : ""}`,
        {
          method: store ? "PATCH" : "POST",
          body: JSON.stringify(
            store
              ? storeEditInput(store, current!, {
                  ...form,
                  name: form.name.trim(),
                  description: form.description.trim(),
                })
              : {
                  name: form.name.trim(),
                  description: form.description.trim(),
                  defaultCurrency,
                  reportCurrency: defaultCurrency,
                  countryCode,
                  status: "ACTIVE",
                  visibility: "PUBLIC",
                },
          ),
        },
      );
      let cleanupWarning = "";
      for (const url of managedVideoCleanupCandidates(
        "commerce-store-videos",
        [current?.videoUrl],
        [saved.videoUrl],
        process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
      )) {
        try {
          await request("/customer-api/storage/object", {
            method: "DELETE",
            body: JSON.stringify({ publicUrl: url, url }),
          });
        } catch {
          cleanupWarning = t(
            "Store saved. The previous video could not be removed; contact support.",
            "Boutique enregistrée. L’ancienne vidéo n’a pas pu être supprimée ; contactez l’assistance.",
          );
        }
      }
      invalidateQueryPaths([
        "/customer-api/commerce/stores?",
        "/customer-api/commerce/stores/" + saved.id,
      ]);
      notify(
        cleanupWarning ||
          t(
            store ? "Store updated." : "Your store is ready.",
            store ? "Boutique modifiée." : "Votre boutique est prête.",
          ),
      );
      onClose();
      if (!store) router.push(`/stores/${saved.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Unable to save store.", "Impossible d’enregistrer la boutique."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function next() {
    if ((step === 0 && !form.name.trim()) || (step === 1 && !form.description.trim())) {
      setError(t("Complete this field to continue.", "Complétez ce champ pour continuer."));
      return;
    }
    setError("");
    setStep((s) => s + 1);
  }
  return (
    <Modal
      title={t(
        store ? "Edit store" : "Create store",
        store ? "Modifier la boutique" : "Créer une boutique",
      )}
      busy={busy || uploading}
      onClose={onClose}
      className="owner-form-dialog"
    >
      <form className="form-stack" onSubmit={submit}>
        {!store && (
          <div className="setup-steps" aria-label={t("Store setup", "Création de la boutique")}>
            {[t("Name", "Nom"), t("Description", "Description"), t("Summary", "Récapitulatif")].map(
              (v, i) => (
                <span
                  key={v}
                  aria-current={step === i ? "step" : undefined}
                  className={step === i ? "active" : ""}
                >
                  {i + 1}. {v}
                </span>
              ),
            )}
          </div>
        )}
        {(store || step === 0) && (
          <label>
            {t("Store name", "Nom de la boutique")}
            <input
              value={form.name}
              maxLength={160}
              required
              autoFocus
              onChange={(e) => set("name", e.target.value)}
            />
            {!store && (
              <span className="muted">{t("Choose a clear name.", "Choisissez un nom clair.")}</span>
            )}
          </label>
        )}
        {(store || step === 1) && (
          <label>
            {t("Business description", "Description de l’activité")}
            <textarea
              value={form.description}
              required
              rows={4}
              autoFocus={!store}
              onChange={(e) => set("description", e.target.value)}
            />
            {!store && (
              <span className="muted">
                {t("Explain what your business does.", "Expliquez l’activité de votre entreprise.")}
              </span>
            )}
          </label>
        )}
        {!store && step === 2 && (
          <div className="confirmation-box">
            <h3>{form.name}</h3>
            <p>{form.description}</p>
            <p>
              {t(
                "Your store will be active and public.",
                "Votre boutique sera active et publique.",
              )}
            </p>
          </div>
        )}
        {(store || step === 2) && (
          <div className="form-grid">
            <label>
              {t("Store currency", "Devise de la boutique")}
              <select
                value={defaultCurrency}
                onChange={(e) => set("defaultCurrency", e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Country code", "Code pays")}
              <input
                required
                maxLength={2}
                pattern="[A-Za-z]{2}"
                value={countryCode}
                onChange={(e) => set("countryCode", e.target.value.toUpperCase())}
              />
            </label>
          </div>
        )}
        {store && (
          <>
            <label>
              {t("Store slug", "Identifiant du lien")}
              <input
                value={form.slug}
                maxLength={180}
                onChange={(e) => set("slug", e.target.value)}
              />
            </label>
            <section className="form-section">
              <h3>{t("Branding", "Identité visuelle")}</h3>
              <MediaUpload
                disabled={uploading}
                label={t("Logo", "Logo")}
                ownerName={store?.name}
                aspect={1}
                value={form.logoUrl}
                scope="commerce-store-images"
                onBusy={setUploading}
                onChange={(v) => set("logoUrl", v || null)}
              />
              <MediaUpload
                disabled={uploading}
                label={t("Banner", "Bannière")}
                ownerName={store?.name}
                aspect={2.1}
                helper={t(
                  "The cover at the top of your public store.",
                  "La couverture en haut de votre boutique publique.",
                )}
                value={form.bannerUrl}
                scope="commerce-store-images"
                onBusy={setUploading}
                onChange={(v) => set("bannerUrl", v || null)}
              />
              <MediaUpload
                disabled={uploading}
                label={t("Store video", "Vidéo de la boutique")}
                kind="video"
                value={form.videoUrl}
                ownerName={store?.name}
                duration={form.videoDurationSeconds}
                scope="commerce-store-videos"
                onBusy={setUploading}
                onChange={(v, d) => {
                  set("videoUrl", v || null);
                  set("videoDurationSeconds", d || null);
                }}
              />
            </section>
            <section className="form-section">
              <h3>{t("Contact and social links", "Contact et réseaux sociaux")}</h3>
              <label>
                {t("WhatsApp number", "Numéro WhatsApp")}
                <input
                  type="tel"
                  value={form.whatsappNumber}
                  maxLength={64}
                  onChange={(e) => set("whatsappNumber", e.target.value)}
                />
              </label>
              <label>
                {t("Contact email", "Adresse e-mail de contact")}
                <input
                  type="email"
                  value={form.contactEmail}
                  maxLength={254}
                  onChange={(e) => set("contactEmail", e.target.value)}
                />
              </label>
              {(
                [
                  "facebookUrl",
                  "instagramUrl",
                  "youtubeUrl",
                  "linkedinUrl",
                  "twitterUrl",
                  "tiktokUrl",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {
                    {
                      facebookUrl: "Facebook",
                      instagramUrl: "Instagram",
                      youtubeUrl: "YouTube",
                      linkedinUrl: "LinkedIn",
                      twitterUrl: "X / Twitter",
                      tiktokUrl: "TikTok",
                    }[key]
                  }
                  <input type="url" value={form[key]} onChange={(e) => set(key, e.target.value)} />
                </label>
              ))}
            </section>
            <div className="form-grid">
              <label>
                {t("Status", "Statut")}
                <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {["DRAFT", "ACTIVE"].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                  {!["DRAFT", "ACTIVE"].includes(store.status) && (
                    <option value={store.status}>{label(store.status)}</option>
                  )}
                </select>
              </label>
              <label>
                {t("Visibility", "Visibilité")}
                <select value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
                  {["PRIVATE", "PUBLIC"].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t("Report currency", "Devise des rapports")}
              <select
                value={form.reportCurrency}
                onChange={(e) => set("reportCurrency", e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading}
            onClick={() => (!store && step > 0 ? setStep((s) => s - 1) : onClose())}
          >
            {!store && step > 0 ? t("Back", "Retour") : t("Cancel", "Annuler")}
          </button>
          {!store && step < 2 ? (
            <button type="button" className="button primary" onClick={next}>
              {t("Continue", "Continuer")}
            </button>
          ) : (
            <SubmitButton busy={busy} disabled={uploading}>
              {t(store ? "Save" : "Create store", store ? "Enregistrer" : "Créer la boutique")}
            </SubmitButton>
          )}
        </div>
      </form>
    </Modal>
  );
}
