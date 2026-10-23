"use client";
import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ReceiptText,
  Tv,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  apiGuideMenuItems,
  guideTrack,
  type GuideMenuGroup,
  type GuideTrack,
} from "@/lib/api-guide-content";
import { businessApiTopic } from "@/lib/business-api-docs";
import { useI18n } from "@/lib/i18n";

function GuideMenuSection({
  group,
  current,
  renderGuide,
}: {
  group: GuideMenuGroup;
  current: string;
  renderGuide: (id: GuideTrack["id"]) => ReactNode;
}) {
  const { language, t } = useI18n();
  const [open, setOpen] = useState(group.id === "payments");
  const active = group.children.some((item) => item.kind === "guide" && item.id === current);
  const upcoming = group.children.every((item) => item.kind === "upcoming");
  const Icon = group.id === "payments" ? WalletCards : ReceiptText;
  useEffect(() => {
    if (active) setOpen(true);
  }, [current, active]);
  return (
    <details
      className="guide-menu-group"
      data-guide-tone={group.tone}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="guide-nav-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="guide-menu-group-copy">
          <strong>{group.title[language === "fr" ? 1 : 0]}</strong>
          {upcoming && <small className="guide-menu-soon">{t("Soon", "Bientôt")}</small>}
        </span>
        <ChevronDown size={14} className="guide-menu-chevron" aria-hidden="true" />
      </summary>
      <div className="guide-menu-children">
        {group.children.map((item) => {
          if (item.kind === "guide") return renderGuide(item.id);
          const ItemIcon = item.icon === "electricity" ? Zap : Tv;
          return (
            <button key={item.id} type="button" disabled data-guide-tone={item.tone}>
              <span className="guide-nav-icon">
                <ItemIcon size={16} aria-hidden="true" />
              </span>
              <span>
                {item.title[language === "fr" ? 1 : 0]}
                <small>{t("Coming soon", "Bientôt disponible")}</small>
              </span>
            </button>
          );
        })}
      </div>
    </details>
  );
}

export function ApiGuideNavigation({
  current,
  completed,
  onSelect,
  icons,
}: {
  current: string;
  completed: string[];
  onSelect: (id: string) => void;
  icons: Record<GuideTrack["icon"], LucideIcon>;
}) {
  const { language, t } = useI18n();
  function renderGuide(id: GuideTrack["id"]) {
    const item = guideTrack(id);
    const Icon = icons[item.icon];
    const count = item.lessons.filter((step) => completed.includes(`${item.id}:${step.id}`)).length;
    const done = count === item.lessons.length;
    return (
      <button
        type="button"
        key={item.id}
        data-guide-tone={item.tone}
        aria-current={item.id === current ? "page" : undefined}
        onClick={() => onSelect(item.id)}
      >
        <span className={`guide-nav-icon ${done ? "complete" : ""}`}>
          <Icon size={16} aria-hidden="true" />
          {done && <Check size={9} className="guide-nav-complete-mark" aria-hidden="true" />}
        </span>
        <span>
          {businessApiTopic(item.id)[language]}
          <small>
            {count} / {item.lessons.length}
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
        ) : (
          <GuideMenuSection
            key={item.id}
            group={item}
            current={current}
            renderGuide={renderGuide}
          />
        ),
      )}
    </nav>
  );
}
