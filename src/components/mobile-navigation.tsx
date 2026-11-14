"use client";
import { useUiText } from "@/lib/use-ui-text";
import { useState } from "react";

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
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "./ui";
import { DeveloperSectionLinks } from "./developer-section-links";
import { StoreSectionLinks } from "./store-section-links";

const tabs = [
  { href: "/overview", label: "Overview", icon: House },
  { href: "/payment-requests", label: "Payment links", icon: Link2 },
  { href: "/stores", label: "Online Stores", icon: Store },
  { href: "/pos", label: "POS", icon: Monitor },
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
  const [storesOpen, setStoresOpen] = useState(false);
  const [expansion, setExpansion] = useState<{ path: string; open: boolean }>();
  const apiOpen =
    expansion?.path === pathname ? expansion.open : pathname.startsWith("/developers");

  const moreActive = pathname.startsWith("/developers") || pathname.startsWith("/settings");
  return (
    <>
      <nav className="mobile-bottom-nav" aria-label={uiText("Mobile navigation")}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const content = (
            <>
              <span className="mobile-tab-icon">
                <Icon size={22} strokeWidth={1.8} />
              </span>
              <span>{uiText(label)}</span>
            </>
          );
          return href === "/stores" ? (
            <button
              key={href}
              type="button"
              className={`mobile-tab ${active || storesOpen ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
              aria-haspopup="dialog"
              aria-expanded={storesOpen}
              onClick={() => {
                onClose();
                setStoresOpen(true);
              }}
            >
              {content}
            </button>
          ) : (
            <Link
              key={href}
              href={href}
              className={`mobile-tab ${active ? "active" : ""} ${href === "/pos" ? "mobile-tab-pos" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })}
        <button
          type="button"
          className={`mobile-tab ${moreActive || open ? "active" : ""}`}
          onClick={() => {
            setStoresOpen(false);
            onOpen();
          }}
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
      {storesOpen && (
        <Modal title={uiText("Online Stores")} variant="sheet" onClose={() => setStoresOpen(false)}>
          <StoreSectionLinks
            pathname={pathname}
            onNavigate={() => setStoresOpen(false)}
            className="mobile-store-links"
          />
        </Modal>
      )}
      {open && (
        <Modal title={uiText("Your workspace")} variant="sheet" onClose={onClose}>
          <div className="mobile-more-links">
            <button
              type="button"
              className="mobile-api-parent"
              aria-expanded={apiOpen}
              aria-controls="mobile-developer-submenu"
              onClick={() => setExpansion({ path: pathname, open: !apiOpen })}
            >
              <span className="tool-icon blue">
                <Code2 size={22} />
              </span>
              <span>
                <strong>{uiText("Payments API")}</strong>
                <small>{uiText("API keys and integrations")}</small>
              </span>
              <span className="workspace-nav-chevron" aria-hidden="true">
                <ChevronDown size={16} strokeWidth={2.5} />
              </span>
            </button>
            <div id="mobile-developer-submenu" hidden={!apiOpen}>
              <DeveloperSectionLinks
                pathname={pathname}
                onNavigate={onClose}
                className="mobile-developer-children"
              />
            </div>
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
