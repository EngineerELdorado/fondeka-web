"use client";
import { useRef, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronRight, Eye, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTrainingQuery } from "@/lib/use-training-query";
import {
  parseTrainingCurriculum,
  trainingPath,
  trainingPreviewCurriculum,
  type TrainingCurriculum,
} from "@/lib/training";
import { useWorkspace } from "./workspace-provider";
import { Empty, ErrorState, Loading, PageHeading } from "./ui";
import { TrainingMaterialOpener } from "./training-material-opener";
import { FileDetails } from "./file-details";
import type { FileMetadata } from "@/lib/file-metadata";

export function TrainingPreview({
  productId,
  onClose,
  fileMetadata,
}: {
  productId: number;
  onClose: () => void;
  fileMetadata?: ReadonlyMap<string, FileMetadata>;
}) {
  const { accountKey } = useWorkspace();
  return (
    <PreviewSession
      key={`${accountKey}:${productId}`}
      productId={productId}
      onClose={onClose}
      fileMetadata={fileMetadata}
    />
  );
}

function PreviewSession({
  productId,
  onClose,
  fileMetadata,
}: {
  productId: number;
  onClose: () => void;
  fileMetadata?: ReadonlyMap<string, FileMetadata>;
}) {
  const { t } = useI18n();
  // Recheck creator access on entry and on focus; never use the paid learner APIs.
  const query = useTrainingQuery<TrainingCurriculum>(trainingPath(productId, true));
  const [current, setCurrent] = useState<string>();
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [progress, setProgress] = useState<{ version: number; ids: ReadonlySet<string> }>();
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  let curriculum: TrainingCurriculum | undefined;
  let hasDrafts = false;
  let error = query.error;
  try {
    if (query.data) {
      const source = parseTrainingCurriculum(query.data);
      if (source.productId !== productId)
        throw new Error(t("Training unavailable.", "Formation indisponible."));
      hasDrafts = source.modules.some((module) =>
        module.materials.some((material) => !module.published || !material.published),
      );
      const withDetails = {
        ...source,
        modules: source.modules.map((module) => ({
          ...module,
          materials: module.materials.map((material) => {
            const local = material.assetKey ? fileMetadata?.get(material.assetKey) : undefined;
            return local
              ? {
                  ...material,
                  contentType: material.contentType ?? local.contentType,
                  fileSize: material.fileSize ?? local.fileSize,
                }
              : material;
          }),
        })),
      };
      curriculum = trainingPreviewCurriculum(
        withDetails,
        progress?.version === source.version ? progress.ids : undefined,
        includeDrafts,
      );
    }
  } catch (failure) {
    error =
      failure instanceof Error
        ? failure.message
        : t("Training unavailable.", "Formation indisponible.");
  }
  const materials = curriculum?.modules.flatMap((module) => module.materials) || [];
  const material =
    materials.find((item) => item.id === current) ||
    materials.find((item) => item.id === curriculum?.nextMaterialId) ||
    materials[0];
  function select(id: string) {
    setCurrent(id);
    requestAnimationFrame(() => {
      lessonHeading.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 760px)").matches)
        lessonHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  return (
    <section className="training-preview">
      <div className="training-preview-banner">
        <Eye size={21} aria-hidden="true" />
        <div>
          <strong>{t("Learner preview", "Aperçu apprenant")}</strong>
          <p>
            {t(
              "Review the saved lessons as a learner. This private preview does not publish content or change learner progress.",
              "Consultez les leçons enregistrées comme un apprenant. Cet aperçu privé ne publie aucun contenu et ne modifie pas la progression des apprenants.",
            )}
          </p>
        </div>
        <button type="button" className="button secondary" onClick={onClose}>
          <ArrowLeft size={16} />
          {t("Back to curriculum", "Retour au programme")}
        </button>
      </div>
      {query.loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={query.refetch} />
      ) : (
        curriculum && (
          <>
            {hasDrafts && (
              <div className="training-preview-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeDrafts}
                    onChange={(event) => {
                      setIncludeDrafts(event.target.checked);
                      setCurrent(undefined);
                      setProgress(undefined);
                    }}
                  />
                  {t("Include draft lessons", "Inclure les leçons en brouillon")}
                </label>
                <p className="muted small">
                  {includeDrafts
                    ? t(
                        "Drafts are visible only in this author preview. Learners still see published lessons only.",
                        "Les brouillons sont visibles uniquement dans cet aperçu auteur. Les apprenants voient toujours uniquement les leçons publiées.",
                      )
                    : t(
                        "You can review saved drafts before publishing them.",
                        "Vous pouvez consulter les brouillons enregistrés avant de les publier.",
                      )}
                </p>
              </div>
            )}
            <PageHeading
              icon={BookOpen}
              title={curriculum.title}
              description={t(
                "Learn in any order. Mark a material complete when you are ready.",
                "Apprenez dans l’ordre de votre choix. Marquez une ressource comme terminée lorsque vous le souhaitez.",
              )}
            >
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setProgress(undefined);
                  setCurrent(undefined);
                }}
              >
                <RotateCcw size={16} />
                {t("Restart preview", "Recommencer l’aperçu")}
              </button>
            </PageHeading>
            {!curriculum.totalMaterials ? (
              <Empty
                icon={BookOpen}
                title={
                  includeDrafts
                    ? t("No saved lessons yet", "Aucune leçon enregistrée")
                    : t("No published lessons yet", "Aucune leçon publiée pour le moment")
                }
                description={
                  hasDrafts
                    ? t(
                        "Include draft lessons to review your content before publication.",
                        "Incluez les leçons en brouillon pour consulter votre contenu avant publication.",
                      )
                    : t(
                        "Add a file or link in the curriculum and save it to preview the lesson here.",
                        "Ajoutez un fichier ou un lien au programme, puis enregistrez-le pour prévisualiser la leçon ici.",
                      )
                }
              >
                {hasDrafts && (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setIncludeDrafts(true)}
                  >
                    {t("Preview draft lessons", "Voir les leçons en brouillon")}
                  </button>
                )}
              </Empty>
            ) : (
              <>
                <div className="training-progress">
                  <progress
                    max={100}
                    value={curriculum.progressPercentage}
                    aria-label={t("Training progress", "Progression de la formation")}
                  />
                  <strong>
                    {curriculum.completedMaterials} / {curriculum.totalMaterials} ·{" "}
                    {curriculum.progressPercentage}%
                  </strong>
                  <button
                    type="button"
                    className="button primary small"
                    disabled={!curriculum.nextMaterialId}
                    onClick={() => select(curriculum.nextMaterialId!)}
                  >
                    {t("Continue learning", "Continuer à apprendre")} <ChevronRight size={15} />
                  </button>
                </div>
                {curriculum.progressPercentage === 100 && (
                  <p className="info-box" role="status">
                    <Check size={18} aria-hidden="true" />{" "}
                    {t(
                      "Training completed. You can revisit any lesson.",
                      "Formation terminée. Vous pouvez revoir toutes les leçons.",
                    )}
                  </p>
                )}
                <div className="training-workspace">
                  <aside
                    className="training-outline"
                    aria-label={t("Training modules", "Modules de formation")}
                  >
                    {curriculum.modules.map((module, index) => (
                      <details className="training-module" key={module.id} open>
                        <summary>
                          <strong>
                            {index + 1}. {module.title}
                          </strong>
                          {!module.published && (
                            <span className="badge amber">{t("Draft", "Brouillon")}</span>
                          )}
                        </summary>
                        {module.description && <p>{module.description}</p>}
                        <ol>
                          {module.materials.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                aria-current={item.id === material?.id ? "step" : undefined}
                                className={item.id === material?.id ? "selected" : ""}
                                onClick={() => select(item.id!)}
                              >
                                {item.completed && (
                                  <Check size={15} aria-label={t("Completed", "Terminé")} />
                                )}
                                <span>{item.title}</span>
                                <small>
                                  {item.type === "FILE" ? t("File", "Fichier") : t("Link", "Lien")}
                                </small>
                                {(!item.published || !module.published) && (
                                  <span className="badge amber">{t("Draft", "Brouillon")}</span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ))}
                  </aside>
                  <section className="training-edit-panel" aria-label={material?.title}>
                    {material && (
                      <>
                        <small className="eyebrow">
                          {material.type === "FILE" ? t("File", "Fichier") : t("Link", "Lien")}
                        </small>
                        <h2 ref={lessonHeading} tabIndex={-1}>
                          {material.title}
                        </h2>
                        <p className="training-notes">{material.description}</p>
                        {material.type === "FILE" && <FileDetails metadata={material} />}
                        <TrainingMaterialOpener
                          key={`${curriculum.version}:${material.id}`}
                          productId={productId}
                          materialId={material.id!}
                          title={material.title}
                          fileMetadata={material}
                          author
                          actionLabel={t("Open material", "Ouvrir la ressource")}
                          onAccessLost={() => void query.refetch()}
                        />
                        <div className="training-completion">
                          <button
                            type="button"
                            className={`button ${material.completed ? "secondary" : "primary"}`}
                            aria-pressed={material.completed === true}
                            onClick={() => {
                              const ids = new Set(
                                progress?.version === curriculum.version ? progress.ids : [],
                              );
                              if (material.completed) ids.delete(material.id!);
                              else ids.add(material.id!);
                              setCurrent(material.id);
                              setProgress({ version: curriculum.version, ids });
                            }}
                          >
                            <Check size={16} />
                            {material.completed
                              ? t("Completed", "Terminé")
                              : t("Mark as completed", "Marquer comme terminé")}
                          </button>
                        </div>
                        <small className="muted">
                          {t(
                            "Completion is your own checklist. It does not lock other materials.",
                            "La progression est votre propre suivi. Elle ne verrouille pas les autres ressources.",
                          )}
                        </small>
                      </>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )
      )}
    </section>
  );
}
