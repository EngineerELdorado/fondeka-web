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

export function TrainingPreview({
  productId,
  onClose,
}: {
  productId: number;
  onClose: () => void;
}) {
  const { accountKey } = useWorkspace();
  return (
    <PreviewSession key={`${accountKey}:${productId}`} productId={productId} onClose={onClose} />
  );
}

function PreviewSession({ productId, onClose }: { productId: number; onClose: () => void }) {
  const { t } = useI18n();
  // Recheck creator access on entry and on focus; never use the paid learner APIs.
  const query = useTrainingQuery<TrainingCurriculum>(trainingPath(productId, true));
  const [current, setCurrent] = useState<string>();
  const [progress, setProgress] = useState<{ version: number; ids: ReadonlySet<string> }>();
  const lessonHeading = useRef<HTMLHeadingElement>(null);
  let curriculum: TrainingCurriculum | undefined;
  let error = query.error;
  try {
    if (query.data) {
      const source = parseTrainingCurriculum(query.data);
      if (source.productId !== productId)
        throw new Error(t("Training unavailable.", "Formation indisponible."));
      curriculum = trainingPreviewCurriculum(
        source,
        progress?.version === source.version ? progress.ids : undefined,
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
              "Explore the published lessons without signing in or purchasing. Progress here is temporary and resets when you leave.",
              "Explorez les leçons publiées sans connexion ni achat. La progression est temporaire et se réinitialise en quittant l’aperçu.",
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
                title={t("No published lessons yet", "Aucune leçon publiée pour le moment")}
                description={t(
                  "Publish a module and at least one material in the curriculum to preview them here. The product can stay in draft.",
                  "Publiez un module et au moins une ressource dans le programme pour les voir ici. Le produit peut rester en brouillon.",
                )}
              />
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
                        <TrainingMaterialOpener
                          key={`${curriculum.version}:${material.id}`}
                          productId={productId}
                          materialId={material.id!}
                          title={material.title}
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
