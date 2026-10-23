"use client";
import { BusinessToolLink as Link } from "./business-tool-link";
import { useUiText } from "@/lib/use-ui-text";
import { useUrlState } from "@/lib/use-url-state";
import { developerHref, developerSections } from "@/lib/developer-navigation";

export function DeveloperSectionLinks({
  pathname,
  onNavigate,
  className = "",
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const uiText = useUiText();
  const { values } = useUrlState();
  return (
    <div className={`developer-section-links ${className}`}>
      {developerSections.map((section) => (
        <Link
          key={section.id}
          href={developerHref(
            section.id,
            pathname.startsWith("/developers") ? values : new URLSearchParams(),
          )}
          onClick={onNavigate}
          className={pathname === section.href ? "active" : ""}
          aria-current={pathname === section.href ? "page" : undefined}
        >
          {uiText(section.label)}
        </Link>
      ))}
    </div>
  );
}
