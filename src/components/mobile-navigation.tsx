"use client";
import { useUiText } from "@/lib/use-ui-text";

import { BusinessToolLink as Link } from "@/components/business-tool-link";
import {
  Code2,
  House,
  Link2,
  LogOut,
  Calculator as Monitor,
  MoreHorizontal,
  Settings2,
  Store,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "./ui";

const tabs = [
  { href: "/overview", label: "Overview", icon: House },
  { href: "/stores", label: "Online Stores", icon: Store },
  { href: "/pos", label: "POS", icon: Monitor },
  { href: "/payment-requests", label: "Payment links", icon: Link2 },
];

export function MobileNavigation({
  pathname,
  open,
  onOpen,
  onClose,
  onLogout,
}: {
  pathname: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const uiText = useUiText();

  const moreActive = pathname.startsWith("/developers") || pathname.startsWith("/settings");
  return (
    <>
      <nav className="mobile-bottom-nav" aria-label={uiText("Mobile navigation")}>
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`mobile-tab ${pathname.startsWith(href) ? "active" : ""} ${href === "/pos" ? "mobile-tab-pos" : ""}`}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <span className="mobile-tab-icon">
              <Icon size={22} strokeWidth={1.8} />
            </span>
            <span>{uiText(label)}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-tab ${moreActive || open ? "active" : ""}`}
          onClick={onOpen}
          aria-label={uiText("More options")}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="mobile-tab-icon">
            <MoreHorizontal size={23} />
          </span>
          <span>{uiText("More")}</span>
        </button>
      </nav>
      {open && (
        <Modal title={uiText("Your workspace")} variant="sheet" onClose={onClose}>
          <div className="mobile-more-links">
            <Link href="/developers" onClick={onClose}>
              <span className="tool-icon blue">
                <Code2 size={22} />
              </span>
              <span>
                <strong>{uiText("API & developers")}</strong>
                <small>{uiText("Credentials, activity, and integrations")}</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/settings" onClick={onClose}>
              <span className="tool-icon mint">
                <Settings2 size={22} />
              </span>
              <span>
                <strong>{uiText("Settings")}</strong>
                <small>{uiText("Account and workspace preferences")}</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <button className="button secondary mobile-signout" onClick={onLogout}>
            <LogOut size={18} />
            {uiText("Sign out")}
          </button>
        </Modal>
      )}
    </>
  );
}
