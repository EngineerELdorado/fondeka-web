"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, FilePlus2, Plus, Trash2 } from "lucide-react";
import { request } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { useUiText } from "@/lib/use-ui-text";
import {
  parseTrainingCurriculum,
  trainingPath,
  trainingPayload,
  type TrainingCurriculum,
  type TrainingMaterial,
  type TrainingModule,
} from "@/lib/training";
import { useTrainingQuery } from "@/lib/use-training-query";
import { useWorkspace } from "./workspace-provider";
import { Loading, ErrorState, Modal } from "./ui";
import { MediaUpload } from "./media-upload";
import { TrainingMaterialOpener } from "./training-material-opener";

type Lesson = TrainingMaterial & { key: string };
type Module = Omit<TrainingModule, "materials"> & { key: string; materials: Lesson[] };
const draftOf = (data: TrainingCurriculum): Module[] =>
  data.modules.map((module) => ({
    ...module,
    key: module.id!,
    materials: module.materials.map((material) => ({ ...material, key: material.id! })),
  }));

function TrainingPublicationBadge({ published }: { published: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`badge ${published ? "green" : "amber"}`}>
      <span aria-hidden="true" />
      {published ? t("Published", "Publié") : t("Draft", "Brouillon")}
    </span>
  );
}

type EditorProps = { productId: number; onClose: () => void; onProductSettings: () => void };
export function TrainingEditor({ productId, onClose, onProductSettings }: EditorProps) {
  const { accountKey } = useWorkspace();
  return (
    <TrainingEditorSession
      key={`${accountKey}:${productId}`}
      productId={productId}
      onClose={onClose}
      onProductSettings={onProductSettings}
    />
  );
}
function TrainingEditorSession({ productId, onClose, onProductSettings }: EditorProps) {
  // Keep the editable draft mounted when the tab regains focus. PUT checks its version.
  const query = useTrainingQuery<TrainingCurriculum>(trainingPath(productId, true), false);
  let curriculum: TrainingCurriculum | undefined;
  let error = query.error;
  try {
    if (query.data) curriculum = parseTrainingCurriculum(query.data);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "Invalid curriculum.";
  }
  return query.loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={query.refetch} />
  ) : curriculum ? (
    <CurriculumWorkspace
      initial={curriculum}
      onClose={onClose}
      onProductSettings={onProductSettings}
    />
  ) : null;
}
function CurriculumWorkspace({
  initial,
  onClose,
  onProductSettings,
}: {
  initial: TrainingCurriculum;
  onClose: () => void;
  onProductSettings: () => void;
}) {
  const { t } = useI18n();
  const ui = useUiText();
  const { notify } = useWorkspace();
  const [baseline, setBaseline] = useState(initial);
  const [modules, setModules] = useState<Module[]>(() => draftOf(initial));
  const [selected, setSelected] = useState<{ module: string; material?: string }>();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [previousDraft, setPreviousDraft] = useState<Module[]>();
  const [remove, setRemove] = useState<{ module: string; material?: string }>();
  const lock = useRef(false);
  const editingUrl = useRef(typeof window === "undefined" ? "" : window.location.href);
  const dirty = JSON.stringify(modules) !== JSON.stringify(draftOf(baseline));
  const module = modules.find((item) => item.key === selected?.module);
  const material = module?.materials.find((item) => item.key === selected?.material);
  useEffect(() => {
    if (!dirty && !busy && !uploading) return;
    const canLeave = () =>
      !busy &&
      !uploading &&
      window.confirm(
        t(
          "Discard unsaved curriculum changes?",
          "Abandonner les modifications non enregistrées du programme ?",
        ),
      );
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest("a[href]");
      if (
        !anchor ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download") ||
        event.metaKey ||
        event.ctrlKey
      )
        return;
      if (!canLeave()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const pop = (event: PopStateEvent) => {
      if (window.location.href !== editingUrl.current && !canLeave()) {
        event.stopImmediatePropagation();
        window.history.forward();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
    };
  }, [dirty, busy, uploading, t]);
  const close = () => {
    if (
      !busy &&
      !uploading &&
      (!dirty ||
        window.confirm(
          t(
            "Discard unsaved curriculum changes?",
            "Abandonner les modifications non enregistrées du programme ?",
          ),
        ))
    )
      onClose();
  };
  const patchModule = (patch: Partial<Module>) =>
    setModules((rows) =>
      rows.map((item) => (item.key === selected?.module ? { ...item, ...patch } : item)),
    );
  const patchMaterial = (patch: Partial<Lesson>) =>
    setModules((rows) =>
      rows.map((item) => ({
        ...item,
        materials: item.materials.map((lesson) =>
          lesson.key === selected?.material ? { ...lesson, ...patch } : lesson,
        ),
      })),
    );
  function addModule() {
    const next: Module = {
      key: crypto.randomUUID(),
      title: "",
      description: "",
      published: true,
      materials: [],
    };
    setModules((rows) => [...rows, next]);
    setSelected({ module: next.key });
  }
  function addMaterial() {
    if (!module) return;
    const next: Lesson = {
      key: crypto.randomUUID(),
      title: "",
      description: "",
      type: "LINK",
      published: true,
    };
    patchModule({ materials: [...module.materials, next] });
    setSelected({ module: module.key, material: next.key });
  }
  function moveModule(key: string, by: number) {
    setModules((rows) => {
      const next = [...rows];
      const at = next.findIndex((item) => item.key === key);
      const to = at + by;
      if (to >= 0 && to < next.length) [next[at], next[to]] = [next[to], next[at]];
      return next;
    });
  }
  function moveMaterial(by: number) {
    if (!module || !material) return;
    const next = [...module.materials];
    const at = next.findIndex((item) => item.key === material.key);
    const to = at + by;
    if (to >= 0 && to < next.length) [next[at], next[to]] = [next[to], next[at]];
    patchModule({ materials: next });
  }
  async function save() {
    if (lock.current || uploading || conflict) return;
    setError("");
    try {
      const payload = trainingPayload(baseline.version, modules);
      lock.current = true;
      setBusy(true);
      const saved = parseTrainingCurriculum(
        await request(trainingPath(initial.productId, true), {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      );
      const moduleIndex = modules.findIndex((item) => item.key === selected?.module);
      const materialIndex =
        module?.materials.findIndex((item) => item.key === selected?.material) ?? -1;
      const next = draftOf(saved);
      setBaseline(saved);
      setModules(next);
      setSelected(
        next[moduleIndex]
          ? {
              module: next[moduleIndex].key,
              material: next[moduleIndex].materials[materialIndex]?.key,
            }
          : undefined,
      );
      notify(
        t(
          "Curriculum saved. Publish the product when it is ready.",
          "Programme enregistré. Publiez le produit lorsqu’il est prêt.",
        ),
      );
    } catch (failure) {
      setError(ui(failure instanceof Error ? failure.message : "Unable to save curriculum."));
      if ((failure as { status?: number })?.status === 409) setConflict(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const latest = parseTrainingCurriculum(await request(trainingPath(initial.productId, true)));
      setPreviousDraft(modules);
      setModules(draftOf(latest));
      setBaseline(latest);
      setSelected(undefined);
      setConflict(false);
      setError("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Unable to reload curriculum.", "Impossible de recharger le programme."),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const count = modules.reduce((n, item) => n + item.materials.length, 0);
  return (
    <section className="training-author">
      <header className="training-heading">
        <div>
          <span className="eyebrow">{t("Training curriculum", "Programme de formation")}</span>
          <h1>{initial.title}</h1>
          <p className="muted">
            {t(
              "One purchase unlocks all published modules and materials, including future additions.",
              "Un achat donne accès à tous les modules et ressources publiés, y compris les ajouts futurs.",
            )}
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading}
            onClick={close}
          >
            {t("Back to products", "Retour aux produits")}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading || dirty}
            onClick={onProductSettings}
          >
            {t("Product settings & publish", "Paramètres du produit et publication")}
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || uploading || !dirty || conflict}
            onClick={() => void save()}
          >
            {busy
              ? t("Saving…", "Enregistrement…")
              : t("Save curriculum", "Enregistrer le programme")}
          </button>
        </div>
      </header>
      <p className="training-count">
        {modules.length} / 100 {t("modules", "modules")} · {count} / 2,000{" "}
        {t("materials", "ressources")}{" "}
        {dirty && <strong>· {t("Unsaved changes", "Modifications non enregistrées")}</strong>}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <div className="info-box">
          <p>
            {t(
              "The curriculum changed elsewhere. Load the latest version for review; your current draft will remain below for reference. Saving is paused until then.",
              "Le programme a été modifié ailleurs. Chargez la dernière version pour la vérifier ; votre brouillon actuel restera visible ci-dessous comme référence. L’enregistrement est suspendu jusque-là.",
            )}
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void reconcile()}
          >
            {t("Load latest for review", "Charger la dernière version pour révision")}
          </button>
        </div>
      )}
      {previousDraft && (
        <details className="training-reference">
          <summary>
            {t(
              "Your previous unsaved draft — use it to reconcile your changes",
              "Votre brouillon précédent — utilisez-le pour rapprocher vos modifications",
            )}
          </summary>
          {previousDraft.map((item) => (
            <section key={item.key}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {item.materials.map((lesson) => (
                <div key={lesson.key}>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.description}</p>
                  <p>{lesson.fileName || lesson.linkUrl}</p>
                  <TrainingPublicationBadge published={lesson.published} />
                </div>
              ))}
            </section>
          ))}
        </details>
      )}
      <div className={`training-workspace${modules.length ? "" : " training-workspace--empty"}`}>
        <aside
          className="training-outline"
          aria-label={t("Curriculum structure", "Structure du programme")}
        >
          {modules.map((item, index) => (
            <section className="training-module" key={item.key}>
              <button
                type="button"
                className={`training-module-title ${selected?.module === item.key && !material ? "selected" : ""}`}
                disabled={busy || uploading}
                onClick={() => setSelected({ module: item.key })}
              >
                <BookOpen size={17} />
                <strong>
                  {index + 1}. {item.title || t("Untitled module", "Module sans titre")}
                </strong>
                <TrainingPublicationBadge published={item.published} />
              </button>
              <div className="training-move">
                <button
                  type="button"
                  className="text-button"
                  disabled={busy || uploading}
                  aria-label={`${item.published ? t("Move module to draft", "Remettre le module en brouillon") : t("Publish module", "Publier le module")} : ${item.title || t("Untitled module", "Module sans titre")}`}
                  onClick={() => {
                    setModules((rows) =>
                      rows.map((row) =>
                        row.key === item.key ? { ...row, published: !row.published } : row,
                      ),
                    );
                    setSelected({ module: item.key });
                  }}
                >
                  {item.published
                    ? t("Move to draft", "Remettre en brouillon")
                    : t("Publish module", "Publier le module")}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Move module up", "Monter le module")}
                  disabled={busy || uploading || index === 0}
                  onClick={() => moveModule(item.key, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t("Move module down", "Descendre le module")}
                  disabled={busy || uploading || index === modules.length - 1}
                  onClick={() => moveModule(item.key, 1)}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
              <ol>
                {item.materials.map((lesson) => (
                  <li key={lesson.key}>
                    <button
                      type="button"
                      className={selected?.material === lesson.key ? "selected" : ""}
                      disabled={busy || uploading}
                      onClick={() => setSelected({ module: item.key, material: lesson.key })}
                    >
                      {lesson.title || t("Untitled material", "Ressource sans titre")}
                      <small>
                        {lesson.type}
                        <TrainingPublicationBadge published={lesson.published && item.published} />
                      </small>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={busy || uploading || modules.length >= 100}
            onClick={addModule}
          >
            <Plus size={16} />
            {t("Add module", "Ajouter un module")}
          </button>
        </aside>
        <div className="training-edit-panel">
          {!module ? (
            <div className="training-empty">
              <BookOpen size={36} />
              <h2>
                {modules.length
                  ? t(
                      "Build your training, one lesson at a time",
                      "Construisez votre formation, une leçon à la fois",
                    )
                  : t("Add your first module", "Ajoutez votre premier module")}
              </h2>
              <p>
                {modules.length
                  ? t(
                      "Select a module or material to edit it. To publish a draft module, choose Publish module beside it, then Save curriculum.",
                      "Sélectionnez un module ou une ressource pour le modifier. Pour publier un module en brouillon, choisissez Publier le module à côté de celui-ci, puis Enregistrer le programme.",
                    )
                  : t(
                      "Add a module, then add its files or links. New modules and materials are marked for publication by default; save the curriculum to apply your changes.",
                      "Ajoutez un module, puis ses fichiers ou liens. Les nouveaux modules et ressources sont cochés pour publication par défaut ; enregistrez le programme pour appliquer vos modifications.",
                    )}
              </p>
              {!modules.length && (
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || uploading}
                  onClick={addModule}
                >
                  <Plus size={18} aria-hidden="true" />
                  {t("Add module", "Ajouter un module")}
                </button>
              )}
            </div>
          ) : (
            <fieldset disabled={busy}>
              <legend>
                {material
                  ? t("Material details", "Détails de la ressource")
                  : t("Module details", "Détails du module")}
              </legend>
              <label>
                {t("Title", "Titre")}
                <input
                  value={material?.title ?? module.title}
                  required
                  maxLength={180}
                  onChange={(event) =>
                    material
                      ? patchMaterial({ title: event.target.value })
                      : patchModule({ title: event.target.value })
                  }
                />
              </label>
              <label>
                {t("Description / learner notes", "Description / notes aux apprenants")}
                <textarea
                  rows={5}
                  maxLength={4000}
                  value={material?.description ?? (material ? "" : module.description) ?? ""}
                  onChange={(event) =>
                    material
                      ? patchMaterial({ description: event.target.value })
                      : patchModule({ description: event.target.value })
                  }
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={material?.published ?? module.published}
                  onChange={(event) =>
                    material
                      ? patchMaterial({ published: event.target.checked })
                      : patchModule({ published: event.target.checked })
                  }
                />
                {material
                  ? t("Publish this material", "Publier cette ressource")
                  : t("Publish this module", "Publier ce module")}
              </label>
              <p className="muted">
                {t(
                  "Save the curriculum to apply publication changes. Learners only see published materials inside published modules.",
                  "Enregistrez le programme pour appliquer les changements de publication. Les apprenants voient uniquement les ressources publiées dans des modules publiés.",
                )}
              </p>
              {material ? (
                <>
                  {!module.published && (
                    <p className="muted">
                      {t(
                        "This module is in draft; its materials remain hidden from learners.",
                        "Ce module est en brouillon ; ses ressources restent masquées aux apprenants.",
                      )}
                    </p>
                  )}
                  <label>
                    {t("Material type", "Type de ressource")}
                    <select
                      disabled={uploading}
                      value={material.type}
                      onChange={(event) =>
                        patchMaterial({
                          type: event.target.value as Lesson["type"],
                          assetKey: null,
                          linkUrl: null,
                          fileName: null,
                        })
                      }
                    >
                      <option value="LINK">{t("HTTPS link", "Lien HTTPS")}</option>
                      <option value="FILE">{t("Private file", "Fichier privé")}</option>
                    </select>
                  </label>
                  {material.type === "LINK" ? (
                    <label>
                      {t("HTTPS link", "Lien HTTPS")}
                      <input
                        type="url"
                        maxLength={2048}
                        value={material.linkUrl || ""}
                        onChange={(event) => patchMaterial({ linkUrl: event.target.value })}
                      />
                      <small>
                        {t(
                          "Links open on the provider’s site. They are not embedded.",
                          "Les liens s’ouvrent sur le site du fournisseur. Ils ne sont pas intégrés.",
                        )}
                      </small>
                    </label>
                  ) : (
                    <>
                      <MediaUpload
                        kind="training"
                        productId={initial.productId}
                        scope="commerce-training-assets"
                        label={t("Lesson file", "Fichier de la leçon")}
                        value={material.assetKey}
                        maxBytes={250 * 1024 * 1024}
                        onBusy={setUploading}
                        onChange={(assetKey, _duration, fileName) =>
                          patchMaterial({
                            assetKey: assetKey || null,
                            fileName: assetKey ? fileName || material.fileName : null,
                          })
                        }
                        helper={t(
                          "Private lesson file · Up to 250 MiB. Promotional media belongs in product settings.",
                          "Fichier de leçon privé · Jusqu’à 250 Mio. Les médias promotionnels se gèrent dans les paramètres du produit.",
                        )}
                      />
                      {material.fileName && <p className="muted">{material.fileName}</p>}
                    </>
                  )}
                  <label>
                    {t("Module", "Module")}
                    <select
                      disabled={uploading}
                      value={module.key}
                      onChange={(event) => {
                        const destination = event.target.value;
                        setModules((rows) =>
                          rows.map((row) => ({
                            ...row,
                            materials:
                              row.key === module.key
                                ? row.materials.filter((lesson) => lesson.key !== material.key)
                                : row.key === destination
                                  ? [...row.materials, material]
                                  : row.materials,
                          })),
                        );
                        setSelected({ module: destination, material: material.key });
                      }}
                    >
                      {modules.map((item) => (
                        <option
                          key={item.key}
                          value={item.key}
                          disabled={item.materials.length >= 200 && item.key !== module.key}
                        >
                          {item.title || t("Untitled module", "Module sans titre")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="parity-actions">
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={uploading || module.materials[0]?.key === material.key}
                      onClick={() => moveMaterial(-1)}
                    >
                      <ArrowUp size={14} />
                      {t("Move up", "Monter")}
                    </button>
                    <button
                      type="button"
                      className="button secondary small"
                      disabled={uploading || module.materials.at(-1)?.key === material.key}
                      onClick={() => moveMaterial(1)}
                    >
                      <ArrowDown size={14} />
                      {t("Move down", "Descendre")}
                    </button>
                    {material.id && !dirty && (
                      <TrainingMaterialOpener
                        key={material.id}
                        productId={initial.productId}
                        materialId={material.id}
                        title={material.title}
                        author
                      />
                    )}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={module.materials.length ? "button secondary" : "button primary"}
                  disabled={uploading || count >= 2000 || module.materials.length >= 200}
                  onClick={addMaterial}
                >
                  <FilePlus2 size={16} />
                  {t("Add material", "Ajouter une ressource")}
                </button>
              )}
              <button
                type="button"
                disabled={uploading}
                className="text-button danger-text"
                onClick={() => setRemove({ module: module.key, material: material?.key })}
              >
                <Trash2 size={15} />
                {material
                  ? t("Remove material", "Retirer la ressource")
                  : t("Remove module", "Retirer le module")}
              </button>
            </fieldset>
          )}
        </div>
      </div>
      {remove && (
        <Modal
          title={
            remove.material
              ? t("Remove material?", "Retirer la ressource ?")
              : t("Remove this module and its materials?", "Retirer ce module et ses ressources ?")
          }
          onClose={() => setRemove(undefined)}
        >
          <p>
            {t(
              "This takes effect when you save the curriculum.",
              "Cette modification prendra effet lors de l’enregistrement du programme.",
            )}
          </p>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={() => setRemove(undefined)}>
              {t("Cancel", "Annuler")}
            </button>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                setModules((rows) =>
                  remove.material
                    ? rows.map((row) => ({
                        ...row,
                        materials: row.materials.filter((lesson) => lesson.key !== remove.material),
                      }))
                    : rows.filter((row) => row.key !== remove.module),
                );
                setSelected(undefined);
                setRemove(undefined);
              }}
            >
              {t("Remove", "Retirer")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
