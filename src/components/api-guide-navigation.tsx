"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChevronDown,
  ListFilter,
  ReceiptText,
  RefreshCw,
  Zap,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import {
  apiGuideMenuItems,
  guideTrack,
  type GuideMenuGroup,
  type GuideTrack,
} from "@/lib/api-guide-content";
import { billPaymentMainLinks, billPaymentReferenceLessons } from "@/lib/api-guide-bills";
import { businessApiTopic } from "@/lib/business-api-docs";
import { apiGuideAvailable } from "@/lib/api-guide-availability";
import { useI18n } from "@/lib/i18n";

function GuideMenuSection({
  group,
  current,
  renderGuide,
  billPaymentsApiReady,
}: {
  group: GuideMenuGroup;
  current: string;
  renderGuide: (id: GuideTrack["id"]) => ReactNode;
  billPaymentsApiReady: boolean;
}) {
  const { language, t } = useI18n();
  const [open, setOpen] = useState(group.id === "payments");
  const active = group.children.some((item) => item.id === current);
  const upcoming = group.children.every(
    (item) => !apiGuideAvailable(item.id, billPaymentsApiReady),
  );
  const Icon = group.id === "payments" ? WalletCards : ReceiptText;
  useEffect(() => {
    if (active) setOpen(true);
  }, [current, active]);
  return (
    <details
      className="guide-menu-group"
      data-guide-tone={group.tone}
      data-active={active}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="guide-nav-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="guide-menu-group-copy">
          <strong>{group.title[language === "fr" ? 1 : 0]}</strong>
          {upcoming && (
            <small className="guide-menu-soon">{t("Coming soon", "Bientôt disponible")}</small>
          )}
        </span>
        <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="guide-menu-children">
        {group.children.map((item) => renderGuide(item.id))}
      </div>
    </details>
  );
}

function BillPaymentMenu({
  current,
  currentLesson,
  completed,
  onSelect,
}: {
  current: string;
  currentLesson: string;
  completed: string[];
  onSelect: (id: string, lesson?: string) => void;
}) {
  const { language, t } = useI18n();
  const track = guideTrack("bill-payments");
  const active = current === track.id;
  const referenceActive =
    active && billPaymentReferenceLessons.some((lesson) => lesson.id === currentLesson);
  const [open, setOpen] = useState(active);
  const [referenceOpen, setReferenceOpen] = useState(referenceActive);
  const referenceList = useRef<HTMLUListElement>(null);
  const reviewed = track.lessons.filter((lesson) =>
    completed.includes(`${track.id}:${lesson.id}`),
  ).length;
  const actionIcons = { request: Zap, television: RefreshCw, "tv-change": ArrowLeftRight };
  useEffect(() => {
    if (active) setOpen(true);
    if (referenceActive) setReferenceOpen(true);
  }, [active, currentLesson, referenceActive]);
  useEffect(() => {
    if (!referenceActive || !open || !referenceOpen) return;
    const list = referenceList.current;
    const selected = list?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!list || !selected) return;
    if (selected.offsetTop < list.scrollTop) list.scrollTop = selected.offsetTop;
    else if (selected.offsetTop + selected.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = selected.offsetTop + selected.offsetHeight - list.clientHeight;
  }, [referenceActive, currentLesson, open, referenceOpen]);
  return (
    <details
      className="guide-menu-group guide-bill-menu"
      data-guide-tone={track.tone}
      data-active={active}
      open={open}
      onToggle={(event) => {
        if (event.target === event.currentTarget) setOpen(event.currentTarget.open);
      }}
    >
      <summary>
        <span className="guide-nav-icon">
          <ReceiptText size={16} aria-hidden="true" />
        </span>
        <span className="guide-menu-group-copy">
          <strong>{track.title[language === "fr" ? 1 : 0]}</strong>
          <small>
            {reviewed} / {track.lessons.length}
          </small>
        </span>
        <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="guide-bill-menu-items">
        <div className="guide-bill-actions">
          {billPaymentMainLinks.map((item) => {
            const done = completed.includes(`${track.id}:${item.id}`);
            const Icon = actionIcons[item.id];
            return (
              <button
                type="button"
                key={item.id}
                aria-current={active && currentLesson === item.id ? "step" : undefined}
                onClick={() => onSelect(track.id, item.id)}
              >
                <span className={`guide-nav-icon${done ? " complete" : ""}`}>
                  <Icon size={15} aria-hidden="true" />
                  {done && (
                    <Check size={9} className="guide-nav-complete-mark" aria-hidden="true" />
                  )}
                </span>
                <span>{item.title[language === "fr" ? 1 : 0]}</span>
                {done && <span className="sr-only">{t("Completed", "Terminé")}</span>}
              </button>
            );
          })}
        </div>
        <details
          className="guide-menu-reference"
          data-active={referenceActive}
          open={referenceOpen}
          onToggle={(event) => setReferenceOpen(event.currentTarget.open)}
        >
          <summary>
            <BookOpen size={15} aria-hidden="true" />
            <span>{t("Reference", "Référence")}</span>
            <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
          </summary>
          <ul
            ref={referenceList}
            className="guide-menu-lessons"
            aria-label={t("Bill payment reference", "Référence des paiements de factures")}
          >
            {billPaymentReferenceLessons.map((lesson) => {
              const done = completed.includes(`${track.id}:${lesson.id}`);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    aria-current={active && currentLesson === lesson.id ? "step" : undefined}
                    onClick={() => onSelect(track.id, lesson.id)}
                  >
                    <span>{lesson.title[language === "fr" ? 1 : 0]}</span>
                    {done && <Check size={13} aria-label={t("Completed", "Terminé")} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    </details>
  );
}

export function ApiGuideNavigation({
  current,
  currentLesson,
  completed,
  onSelect,
  onOpenCatalog,
  icons,
  billPaymentsApiReady,
}: {
  current: string;
  currentLesson: string;
  completed: string[];
  onSelect: (id: string, lesson?: string) => void;
  onOpenCatalog: () => void;
  icons: Record<GuideTrack["icon"], LucideIcon>;
  billPaymentsApiReady: boolean;
}) {
  const { language, t } = useI18n();
  function renderGuide(id: GuideTrack["id"]) {
    const item = guideTrack(id);
    const available = apiGuideAvailable(id, billPaymentsApiReady);
    const Icon = icons[item.icon];
    const count = item.lessons.filter((step) => completed.includes(`${item.id}:${step.id}`)).length;
    const done = available && count === item.lessons.length;
    return (
      <button
        type="button"
        key={item.id}
        disabled={!available}
        data-guide-tone={item.tone}
        aria-current={item.id === current ? "page" : undefined}
        onClick={() => {
          if (available) onSelect(item.id);
        }}
      >
        <span className={`guide-nav-icon ${done ? "complete" : ""}`}>
          <Icon size={16} aria-hidden="true" />
          {done && <Check size={9} className="guide-nav-complete-mark" aria-hidden="true" />}
        </span>
        <span>
          {businessApiTopic(item.id)[language]}
          <small>
            {available
              ? `${count} / ${item.lessons.length}`
              : t("Coming soon", "Bientôt disponible")}
          </small>
        </span>
        {done && <span className="sr-only">{t("Completed", "Terminé")}</span>}
      </button>
    );
  }
  return (
    <nav className="guide-path-nav" aria-label={t("Integration guides", "Guides d’intégration")}>
      {apiGuideMenuItems.map((item) =>
        item.kind === "guide" ? (
          renderGuide(item.id)
        ) : item.kind === "catalog" ? (
          <button
            key={item.id}
            type="button"
            data-guide-tone="teal"
            aria-haspopup="dialog"
            onClick={onOpenCatalog}
          >
            <span className="guide-nav-icon">
              <ListFilter size={16} aria-hidden="true" />
            </span>
            <span>{item.title[language === "fr" ? 1 : 0]}</span>
          </button>
        ) : item.id === "bills" ? (
          apiGuideAvailable("bill-payments", billPaymentsApiReady) ? (
            <BillPaymentMenu
              key={item.id}
              current={current}
              currentLesson={currentLesson}
              completed={completed}
              onSelect={onSelect}
            />
          ) : (
            renderGuide("bill-payments")
          )
        ) : (
          <GuideMenuSection
            key={item.id}
            group={item}
            current={current}
            renderGuide={renderGuide}
            billPaymentsApiReady={billPaymentsApiReady}
          />
        ),
      )}
    </nav>
  );
}
