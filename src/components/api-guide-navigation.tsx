"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Coins,
  ListFilter,
  ReceiptText,
  Smartphone,
  Tv,
  Zap,
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
import { apiGuideAvailable, billGuideLessonAvailable } from "@/lib/api-guide-availability";
import type { BillPaymentApiAvailability } from "@/lib/types";
import type { ApiPaymentKind } from "@/lib/api-catalog";
import { useI18n } from "@/lib/i18n";

function GuideMenuSection({
  group,
  current,
  renderGuide,
  onOpenCatalog,
  billPaymentsApiReady,
}: {
  group: GuideMenuGroup;
  current: string;
  renderGuide: (id: GuideTrack["id"]) => ReactNode;
  onOpenCatalog: (kind?: ApiPaymentKind) => void;
  billPaymentsApiReady: boolean;
}) {
  const { language, t } = useI18n();
  const active = group.children.some((item) => item.id === current);
  const [open, setOpen] = useState(
    active || (group.id === "mobile-money" && ["overview", "quickstart"].includes(current)),
  );
  const upcoming = group.children.every(
    (item) => !apiGuideAvailable(item.id, billPaymentsApiReady),
  );
  const Icon =
    group.id === "mobile-money" ? Smartphone : group.id === "crypto" ? Coins : ReceiptText;
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
      {group.catalogKind && (
        <details className="guide-menu-reference">
          <summary>
            <BookOpen size={15} aria-hidden="true" />
            <span>{t("Reference", "Référence")}</span>
            <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
          </summary>
          <ul className="guide-menu-lessons">
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onOpenCatalog(group.catalogKind)}
              >
                <span>{t("Available payment methods", "Moyens de paiement disponibles")}</span>
              </button>
            </li>
          </ul>
        </details>
      )}
    </details>
  );
}

function BillPaymentMenu({
  current,
  currentLesson,
  completed,
  onSelect,
  available,
  availability,
}: {
  current: string;
  currentLesson: string;
  completed: string[];
  onSelect: (id: string, lesson?: string) => void;
  available: boolean;
  availability: BillPaymentApiAvailability;
}) {
  const { language, t } = useI18n();
  const track = guideTrack("bill-payments");
  const active = current === track.id;
  const referenceActive =
    active && billPaymentReferenceLessons.some((lesson) => lesson.id === currentLesson);
  const [open, setOpen] = useState(active);
  const [referenceOpen, setReferenceOpen] = useState(referenceActive);
  const referenceList = useRef<HTMLUListElement>(null);
  const enabledLessons = track.lessons.filter((lesson) =>
    billGuideLessonAvailable(lesson, availability),
  );
  const reviewed = enabledLessons.filter((lesson) =>
    completed.includes(`${track.id}:${lesson.id}`),
  ).length;
  const actionIcons = { request: Zap, television: Tv };
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
          {available ? (
            <small>
              {reviewed} / {enabledLessons.length}
            </small>
          ) : (
            <small className="guide-menu-soon">{t("Coming soon", "Bientôt disponible")}</small>
          )}
        </span>
        <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="guide-bill-menu-items">
        <div className="guide-bill-actions">
          {billPaymentMainLinks.map((item) => {
            const enabled = availability[item.category] === true;
            const done = enabled && completed.includes(`${track.id}:${item.id}`);
            const Icon = actionIcons[item.id];
            return (
              <button
                type="button"
                key={item.id}
                disabled={!enabled}
                aria-current={active && currentLesson === item.id ? "step" : undefined}
                onClick={() => onSelect(track.id, item.id)}
              >
                <span className={`guide-nav-icon${done ? " complete" : ""}`}>
                  <Icon size={15} aria-hidden="true" />
                  {done && (
                    <Check size={9} className="guide-nav-complete-mark" aria-hidden="true" />
                  )}
                </span>
                <span>
                  {item.title[language === "fr" ? 1 : 0]}
                  {!enabled && (
                    <small className="guide-menu-soon">
                      {" "}
                      · {t("Coming soon", "Bientôt disponible")}
                    </small>
                  )}
                </span>
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
              const enabled = billGuideLessonAvailable(lesson, availability);
              const done = enabled && completed.includes(`${track.id}:${lesson.id}`);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    disabled={!enabled}
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
  billPaymentsApiAvailability,
}: {
  current: string;
  currentLesson: string;
  completed: string[];
  onSelect: (id: string, lesson?: string) => void;
  onOpenCatalog: (kind?: ApiPaymentKind) => void;
  icons: Record<GuideTrack["icon"], LucideIcon>;
  billPaymentsApiReady: boolean;
  billPaymentsApiAvailability: BillPaymentApiAvailability;
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
            onClick={() => onOpenCatalog()}
          >
            <span className="guide-nav-icon">
              <ListFilter size={16} aria-hidden="true" />
            </span>
            <span>{item.title[language === "fr" ? 1 : 0]}</span>
          </button>
        ) : item.id === "bills" ? (
          <BillPaymentMenu
            key={item.id}
            current={current}
            currentLesson={currentLesson}
            completed={completed}
            onSelect={onSelect}
            available={billPaymentsApiReady}
            availability={billPaymentsApiAvailability}
          />
        ) : (
          <GuideMenuSection
            key={item.id}
            group={item}
            current={current}
            renderGuide={renderGuide}
            onOpenCatalog={onOpenCatalog}
            billPaymentsApiReady={billPaymentsApiReady}
          />
        ),
      )}
    </nav>
  );
}
