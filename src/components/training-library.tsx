"use client";
import Link from "next/link";
import { useState, useRef } from "react";
import { BookOpen, Check, ChevronRight, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { useTrainingQuery } from "@/lib/use-training-query";
import { request } from "@/lib/data";
import { safeLink } from "@/lib/format";
import {
  parseTrainingCurriculum,
  trainingPath,
  trainingMaterialPath,
  type TrainingCurriculum,
  type TrainingSummary,
} from "@/lib/training";
import type { Page } from "@/lib/types";
import { useWorkspace } from "./workspace-provider";
import { PageHeading, Loading, Empty, ErrorState, Pagination } from "./ui";
import { TrainingMaterialOpener } from "./training-material-opener";

export function TrainingLibrary() {
  const { t } = useI18n();
  const { page, update } = useUrlState();
  const library = useTrainingQuery<Page<TrainingSummary>>(
    `/customer-api/commerce/trainings?page=${page}&size=20`,
  );
  return (
    <>
      <PageHeading
        icon={BookOpen}
        title={t("My learning", "Mes formations")}
        description={t(
          "Your purchased trainings, ready whenever you are.",
          "Vos formations achetées, disponibles à votre rythme.",
        )}
      >
        <button type="button" className="button secondary" onClick={() => void library.refetch()}>
          <RefreshCw size={15} />
          {t("Refresh", "Actualiser")}
        </button>
      </PageHeading>
      {library.loading ? (
        <Loading />
      ) : library.error ? (
        <ErrorState message={library.error} retry={library.refetch} />
      ) : !library.data?.content?.length ? (
        <Empty
          icon={BookOpen}
          title={t("Your learning starts here", "Votre apprentissage commence ici")}
          description={t(
            "Trainings appear here after a qualifying purchase. Business Tools activation does not enroll you in a training.",
            "Les formations apparaissent ici après un achat éligible. L’activation des outils Business ne donne pas accès à une formation.",
          )}
        />
      ) : (
        <div className="training-library-grid">
          {library.data.content.map((item) => (
            <Link
              key={item.productId}
              href={`/trainings/${item.productId}`}
              className="training-library-card"
            >
              <div className="training-library-image">
                <BookOpen size={36} aria-hidden="true" />
                {safeLink(item.imageUrl || "") ? (
                  <img
                    src={safeLink(item.imageUrl || "")}
                    alt={item.title}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}
              </div>
              <div className="training-library-body">
                <small>{item.storeName}</small>
                <h2>{item.title}</h2>
                <progress
                  max={100}
                  value={item.progressPercentage}
                  aria-label={t("Training progress", "Progression de la formation")}
                />
                <p>
                  {item.completedMaterials} / {item.totalMaterials}{" "}
                  {t("materials completed", "ressources terminées")} · {item.progressPercentage}%
                </p>
                <strong>
                  {item.progressPercentage === 100
                    ? t("Revisit training", "Revoir la formation")
                    : t("Continue learning", "Continuer à apprendre")}{" "}
                  <ChevronRight size={16} />
                </strong>
              </div>
            </Link>
          ))}
        </div>
      )}
      {library.data && (
        <Pagination
          page={page}
          pages={library.data.totalPages}
          total={library.data.totalElements}
          onChange={(value) => update({ page: value })}
        />
      )}
    </>
  );
}
export function TrainingLearner({ productId }: { productId: number }) {
  const { accountKey } = useWorkspace();
  return <LearnerSession key={`${accountKey}:${productId}`} productId={productId} />;
}
function LearnerSession({ productId }: { productId: number }) {
  const { t } = useI18n();
  const query = useTrainingQuery<TrainingCurriculum>(trainingPath(productId));
  const [current, setCurrent] = useState<string>();
  const [mutation, setMutation] = useState<{ version: number; data: TrainingCurriculum }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  let data: TrainingCurriculum | undefined;
  let queryError = query.error;
  try {
    if (query.data) data = parseTrainingCurriculum(query.data);
  } catch (failure) {
    queryError =
      failure instanceof Error
        ? failure.message
        : t("Unable to read training.", "Impossible de lire la formation.");
  }
  // A fresh eligibility read always supersedes a previous completion response.
  const curriculum =
    data && mutation && mutation.version === data.version && mutation.data.version === data.version
      ? mutation.data
      : data;
  const material = curriculum?.modules
    .flatMap((module) => module.materials)
    .find((item) => item.id === current);
  async function complete(completed: boolean) {
    if (!material?.id || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = parseTrainingCurriculum(
        await request(trainingMaterialPath(productId, material.id, "progress"), {
          method: "PATCH",
          body: JSON.stringify({ completed }),
        }),
      );
      setMutation({ version: saved.version, data: saved });
      await query.refetch();
      setMutation(undefined);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : t("Unable to update progress.", "Impossible de mettre à jour la progression."),
      );
      await query.refetch();
      setMutation(undefined);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/trainings" className="back-link">
        ← {t("My learning", "Mes formations")}
      </Link>
      {query.loading ? (
        <Loading />
      ) : queryError ? (
        <ErrorState message={queryError} retry={query.refetch} />
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
                disabled={busy}
                onClick={() => {
                  setMutation(undefined);
                  void query.refetch();
                }}
              >
                <RefreshCw size={15} />
                {t("Refresh", "Actualiser")}
              </button>
            </PageHeading>
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
                disabled={busy || !curriculum.nextMaterialId}
                onClick={() => setCurrent(curriculum.nextMaterialId || undefined)}
              >
                {t("Continue learning", "Continuer à apprendre")}
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="training-workspace">
              <aside
                className="training-outline"
                aria-label={t("Training modules", "Modules de formation")}
              >
                {curriculum.modules.map((module) => (
                  <section className="training-module" key={module.id}>
                    <h2>{module.title}</h2>
                    {module.description && <p>{module.description}</p>}
                    <ol>
                      {module.materials.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={busy}
                            aria-current={item.id === material?.id ? "step" : undefined}
                            className={item.id === material?.id ? "selected" : ""}
                            onClick={() => setCurrent(item.id)}
                          >
                            {item.completed && (
                              <Check size={15} aria-label={t("Completed", "Terminé")} />
                            )}
                            <span>{item.title}</span>
                            <small>{item.type}</small>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </aside>
              <section className="training-edit-panel" aria-live="polite">
                {material ? (
                  <>
                    <small className="eyebrow">{material.type}</small>
                    <h2>{material.title}</h2>
                    <p className="training-notes">{material.description}</p>
                    <TrainingMaterialOpener
                      key={material.id}
                      productId={productId}
                      materialId={material.id!}
                      title={material.title}
                      onAccessLost={() => {
                        setMutation(undefined);
                        void query.refetch();
                      }}
                    />
                    <label className="checkbox-label training-completion">
                      <input
                        type="checkbox"
                        checked={material.completed === true}
                        disabled={busy}
                        onChange={(event) => void complete(event.target.checked)}
                      />
                      {t("Mark as completed", "Marquer comme terminé")}
                    </label>
                    <small className="muted">
                      {t(
                        "Completion is your own checklist. It does not lock other materials.",
                        "La progression est votre propre suivi. Elle ne verrouille pas les autres ressources.",
                      )}
                    </small>
                    {error && (
                      <p className="form-error" role="alert">
                        {error}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="training-empty">
                    <BookOpen size={36} />
                    <h2>
                      {t(
                        "Choose a material or continue where you left off",
                        "Choisissez une ressource ou reprenez votre apprentissage",
                      )}
                    </h2>
                    <p>
                      {t(
                        "Your purchase includes every published lesson. New published content appears here without another payment.",
                        "Votre achat inclut toutes les leçons publiées. Les nouveaux contenus publiés apparaissent ici sans autre paiement.",
                      )}
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}
