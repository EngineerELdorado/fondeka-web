"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Gem,
  History,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  Webhook,
  Smartphone,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useUrlState } from "@/lib/use-url-state";
import { businessApiDocsRoot, businessApiTopic } from "@/lib/business-api-docs";
import {
  apiGuideTracks,
  apiGuideMenuItems,
  apiGuideMenuTracks,
  guideTrack,
  guideLesson,
  parseGuideProgress,
  type GuideCopy,
  type GuideTrack,
  type GuideLesson,
} from "@/lib/api-guide-content";
import { ApiGuideEndpoint } from "./api-guide-endpoint";
import { ApiGuideConfirmation } from "./api-guide-confirmation";
import { ApiGuideQuickstart } from "./api-guide-quickstart";
import { ApiGuideNavigation } from "./api-guide-navigation";
import { ApiGuidePaymentMethods } from "./api-guide-catalog";
import type { ApiGuideSetup } from "@/lib/api-guide-setup";
import { useWorkspace } from "./workspace-provider";
import { Loading } from "./ui";

const Reference = dynamic(() => import("./business-api-reference"), {
  loading: () => <Loading rows={3} />,
});
const icons = {
  map: Compass,
  rocket: Rocket,
  collect: ArrowDownLeft,
  send: ArrowUpRight,
  "crypto-collect": ArrowDownToLine,
  "crypto-send": ArrowUpFromLine,
  states: Layers3,
  webhook: Webhook,
  test: Terminal,
  live: ShieldCheck,
  history: History,
};

function KnowledgeCheck({ check }: { check: NonNullable<GuideLesson["check"]> }) {
  const { language, t } = useI18n();
  const copy = (value: GuideCopy) => value[language === "fr" ? 1 : 0];
  const [answer, setAnswer] = useState<number>();
  const correct = answer === check.correct;
  return (
    <fieldset
      className={`guide-checkpoint ${answer === undefined ? "" : correct ? "correct" : "try-again"}`}
    >
      <legend>
        <Sparkles size={16} />
        {t("Quick check", "Petit défi")}
      </legend>
      <p>{copy(check.question)}</p>
      <div>
        {check.answers.map((choice, index) => (
          <label key={index}>
            <input
              type="radio"
              name="guide-knowledge-check"
              checked={answer === index}
              onChange={() => {
                setAnswer(index);
              }}
            />
            <span>{copy(choice)}</span>
            {answer === index && correct && <Check size={16} aria-hidden="true" />}
          </label>
        ))}
      </div>
      <p className="guide-check-feedback" role="status">
        {answer === undefined ? (
          t("Choose an answer.", "Choisissez une réponse.")
        ) : correct ? (
          <>
            <CheckCircle2 size={16} />
            {copy(check.explanation)}
          </>
        ) : (
          t(
            "Not quite. Review the example and try again.",
            "Pas tout à fait. Relisez l’exemple et réessayez.",
          )
        )}
      </p>
    </fieldset>
  );
}

function LessonContent({
  track,
  lesson,
  completed,
  onComplete,
  onPrevious,
  onNextGuide,
  setup,
}: {
  track: GuideTrack;
  lesson: GuideLesson;
  completed: boolean;
  onComplete: () => void;
  onPrevious: () => void;
  onNextGuide: () => void;
  setup: ApiGuideSetup;
}) {
  const { language, t } = useI18n();
  const copy = (value: GuideCopy) => value[language === "fr" ? 1 : 0];
  const [referenceOpen, setReferenceOpen] = useState(false);
  const lessonIndex = track.lessons.indexOf(lesson);
  const last = lessonIndex === track.lessons.length - 1;
  const FlowIcon = icons[track.icon];
  const introduction = track.id === "overview" || track.id === "quickstart";
  const payloadOnly = lesson.presentation === "payload";
  return (
    <>
      {!introduction && !payloadOnly && (
        <>
          <div className="guide-lesson-heading">
            <span>
              {t("Step", "Étape")} {lessonIndex + 1} / {track.lessons.length}
            </span>
            {completed && (
              <span className="guide-reviewed">
                <CheckCircle2 size={15} />
                {t("Reviewed", "Étudié")}
              </span>
            )}
            <h3>{copy(lesson.title)}</h3>
            <p>{copy(lesson.summary)}</p>
          </div>
          {!lesson.confirmation && (
            <ol className="guide-flow" aria-label={t("How it works", "Comment ça marche")}>
              {lesson.flow.map((node, index) => (
                <li key={index}>
                  <span className="guide-flow-icon">
                    {index === 0 ? (
                      <Terminal size={19} />
                    ) : index === 1 ? (
                      <FlowIcon size={19} />
                    ) : (
                      <CheckCircle2 size={19} />
                    )}
                  </span>
                  <strong>{copy(node)}</strong>
                  {index < 2 && (
                    <ArrowRight size={16} className="guide-flow-arrow" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {lesson.example && (
        <ApiGuideEndpoint example={lesson.example} hideRoute={payloadOnly} setup={setup} />
      )}
      {lesson.confirmation && <ApiGuideConfirmation examples={lesson.confirmation} setup={setup} />}
      {track.id === "quickstart" && <ApiGuideQuickstart setup={setup} />}
      {lesson.tips && (
        <div className="guide-takeaways">
          {lesson.tips.map((tip, index) => (
            <p key={index}>
              <span>
                <Check size={14} />
              </span>
              {copy(tip)}
            </p>
          ))}
        </div>
      )}
      {lesson.resources && (
        <div className="guide-resource-links">
          {lesson.resources.map((resource) => (
            <a key={resource.file} href={`${businessApiDocsRoot}/${resource.file}`} download>
              <Terminal size={15} />
              {copy(resource.label)}
              <ArrowUpRight size={14} />
            </a>
          ))}
        </div>
      )}
      {track.id === "overview" && <ApiGuideOverview />}
      {lesson.check && (
        <details className="guide-optional-check">
          <summary>
            <Sparkles size={16} />
            {t("Quick check · Optional", "Petit défi · Facultatif")}
            <ChevronDown size={14} />
          </summary>
          <KnowledgeCheck check={lesson.check} />
        </details>
      )}
      {introduction ? (
        <div className="guide-intro-footer">
          <button type="button" className="button primary" onClick={onComplete}>
            {track.id === "overview"
              ? t("Get started", "Commencer")
              : t("Start integrating", "Passer à l’intégration")}
            <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="guide-lesson-footer">
          <button
            type="button"
            className="button secondary"
            onClick={onPrevious}
            disabled={lessonIndex === 0}
          >
            <ArrowLeft size={15} />
            {t("Back", "Retour")}
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              onComplete();
              if (last) onNextGuide();
            }}
          >
            {last ? t("Next guide", "Guide suivant") : t("Next section", "Section suivante")}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {!introduction && (
        <details
          className="guide-full-reference"
          onToggle={(event) => setReferenceOpen(event.currentTarget.open)}
        >
          <summary>
            <BookOpen size={17} />
            <span>
              {t(
                "Full reference & implementation details",
                "Référence complète et détails d’implémentation",
              )}
            </span>
            <ChevronDown size={16} />
          </summary>
          {referenceOpen && <Reference />}
        </details>
      )}
    </>
  );
}
function ApiGuideOverview() {
  const { t } = useI18n();
  const { update } = useUrlState();
  const channels = [
    {
      icon: Smartphone,
      title: t("Mobile money", "Mobile money"),
      description: t(
        "Collect from customers and send money to recipients’ phones.",
        "Encaissez auprès de vos clients et envoyez de l’argent vers les téléphones des bénéficiaires.",
      ),
      collect: "mobile-money-collection",
      payout: "mobile-money-payout",
    },
    {
      icon: Gem,
      title: t("Crypto", "Crypto"),
      description: t(
        "Collect through crypto invoices and send crypto from your fiat wallet.",
        "Encaissez via des factures crypto et envoyez des cryptos depuis votre portefeuille fiat.",
      ),
      collect: "crypto-collection",
      payout: "crypto-payout",
    },
  ];
  return (
    <>
      <div className="guide-capability-cards">
        {channels.map((channel) => (
          <section key={channel.collect}>
            <span className="guide-capability-icon">
              <channel.icon size={23} />
            </span>
            <span className="guide-available">
              {t("Available today", "Disponible aujourd’hui")}
            </span>
            <h3>{channel.title}</h3>
            <p>{channel.description}</p>
            <div>
              <button type="button" onClick={() => update({ doc: channel.collect, lesson: null })}>
                {t("Collections", "Encaissements")}
                <ArrowUpRight size={13} />
              </button>
              <button type="button" onClick={() => update({ doc: channel.payout, lesson: null })}>
                {t("Payouts", "Décaissements")}
                <ArrowUpRight size={13} />
              </button>
            </div>
          </section>
        ))}
      </div>
      <div className="guide-future-services">
        <Sparkles size={20} />
        <div>
          <strong>{t("Looking ahead", "Et pour la suite")}</strong>
          <p>
            {t(
              "Bill payments and other services may be added in future releases.",
              "Le paiement de factures et d’autres services pourront être ajoutés dans de futures versions.",
            )}
          </p>
        </div>
        <span>{t("Future services", "Services à venir")}</span>
      </div>
    </>
  );
}

export default function BusinessApiDocumentation({ setup }: { setup: ApiGuideSetup }) {
  const { language, t } = useI18n();
  const copy = (value: GuideCopy) => value[language === "fr" ? 1 : 0];
  const { values, update } = useUrlState();
  const { accountKey } = useWorkspace();
  const topic = businessApiTopic(values.get("doc"));
  const track = guideTrack(topic.id);
  const lesson = guideLesson(track, values.get("lesson"));
  const current = `${track.id}:${lesson.id}`;
  const [saved, setSaved] = useState<{ account: string | null; ids: string[] }>({
    account: null,
    ids: [],
  });
  const completed = saved.account === accountKey ? saved.ids : [];
  const [notice, setNotice] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(current);
  const storageKey = accountKey ? `fondeka:api-learning:v1:${accountKey}` : null;
  useEffect(() => {
    let ids: string[] = [];
    try {
      if (storageKey) ids = parseGuideProgress(sessionStorage.getItem(storageKey));
    } catch {
      /* Progress is optional. */
    }
    setSaved({ account: accountKey, ids });
  }, [accountKey, storageKey]);
  useEffect(() => {
    if (previous.current !== current) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
      previous.current = current;
    }
  }, [current]);
  const reviewed = track.lessons.filter((item) =>
    completed.includes(`${track.id}:${item.id}`),
  ).length;
  const index = track.lessons.indexOf(lesson);
  const Icon = icons[track.icon];
  function selectGuide(id: string) {
    setNotice("");
    update({ doc: id, lesson: null });
  }
  function nextGuide() {
    const next =
      apiGuideTracks
        .slice(apiGuideTracks.indexOf(track) + 1)
        .find((item) => apiGuideMenuTracks.includes(item)) || apiGuideMenuTracks[0];
    selectGuide(next.id);
  }
  function completeStep() {
    const ids = [...new Set([...completed, current])];
    setSaved({ account: accountKey, ids });
    try {
      if (storageKey) sessionStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {
      /* In-memory progress remains usable. */
    }
    if (track.id === "overview" || track.id === "quickstart") nextGuide();
    else if (index < track.lessons.length - 1) update({ lesson: track.lessons[index + 1].id });
    else setNotice(t("Guide completed. Keep building!", "Guide terminé. Continuez à créer !"));
  }
  return (
    <div className="guide-learning-layout">
      <aside className="guide-path-sidebar">
        <figure className="guide-developer-illustration">
          <Image
            src="/illustrations/api-developer.svg"
            width={800}
            height={573}
            alt={t("Developer writing code", "Développeur écrivant du code")}
          />
        </figure>
        <ApiGuideNavigation
          current={topic.id}
          completed={completed}
          onSelect={selectGuide}
          onOpenCatalog={() => setCatalogOpen(true)}
          icons={icons}
        />
      </aside>
      <div className="guide-content">
        <label className="guide-mobile-topic">
          <span>{t("API guides", "Guides API")}</span>
          <select
            value={topic.id}
            onChange={(event) => {
              if (event.target.value === "payment-methods") setCatalogOpen(true);
              else if (apiGuideMenuTracks.some((item) => item.id === event.target.value))
                selectGuide(event.target.value);
            }}
          >
            {!apiGuideMenuTracks.includes(track) && (
              <option value={topic.id} hidden>
                {topic[language]}
              </option>
            )}
            {apiGuideMenuItems.map((item) =>
              item.kind === "guide" ? (
                <option key={item.id} value={item.id}>
                  {businessApiTopic(item.id)[language]}
                </option>
              ) : item.kind === "catalog" ? (
                <option key={item.id} value={item.id}>
                  {item.title[language === "fr" ? 1 : 0]}
                </option>
              ) : (
                <optgroup key={item.id} label={item.title[language === "fr" ? 1 : 0]}>
                  {item.children.map((child) =>
                    child.kind === "guide" ? (
                      <option key={child.id} value={child.id}>
                        {businessApiTopic(child.id)[language]}
                      </option>
                    ) : (
                      <option key={child.id} value={`upcoming:${child.id}`} disabled>
                        {child.title[language === "fr" ? 1 : 0]} ·{" "}
                        {t("Coming soon", "Bientôt disponible")}
                      </option>
                    ),
                  )}
                </optgroup>
              ),
            )}
          </select>
        </label>
        <header className="guide-track-header" data-guide-tone={track.tone}>
          <span className="guide-track-icon">
            <Icon size={24} />
          </span>
          <div>
            <span className="guide-kicker">{t("BUILD WITH FONDEKA", "CRÉEZ AVEC FONDEKA")}</span>
            <h2 ref={heading} tabIndex={-1}>
              {copy(track.title)}
            </h2>
            <p>{copy(track.summary)}</p>
          </div>
          {reviewed === track.lessons.length && (
            <span className="guide-achievement" title={t("Guide completed", "Guide terminé")}>
              <Trophy size={21} />
            </span>
          )}
        </header>
        {track.lessons.length > 1 && (
          <nav className="guide-steps" aria-label={t("Guide steps", "Étapes du guide")}>
            <ol>
              {track.lessons.map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={item.id === lesson.id ? "step" : undefined}
                    onClick={() => update({ lesson: item.id })}
                  >
                    <span>
                      {completed.includes(`${track.id}:${item.id}`) ? <Check size={13} /> : i + 1}
                    </span>
                    {copy(item.title)}
                  </button>
                </li>
              ))}
            </ol>
            <progress
              max={track.lessons.length}
              value={reviewed}
              aria-label={t("Steps completed", "Étapes terminées")}
            />
          </nav>
        )}
        {notice && (
          <div className="guide-completion" role="status">
            <Trophy size={22} />
            <span>{notice}</span>
            <button type="button" onClick={nextGuide}>
              {t("Next guide", "Guide suivant")}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
        <LessonContent
          key={current}
          track={track}
          lesson={lesson}
          completed={completed.includes(current)}
          onComplete={completeStep}
          onPrevious={() => {
            if (index > 0) update({ lesson: track.lessons[index - 1].id });
          }}
          onNextGuide={nextGuide}
          setup={setup}
        />
      </div>
      {catalogOpen && (
        <ApiGuidePaymentMethods setup={setup} onClose={() => setCatalogOpen(false)} />
      )}
    </div>
  );
}
