"use client";

import Link from "next/link";
import {
  Code2,
  House,
  Link2,
  LogOut,
  Monitor,
  MoreHorizontal,
  Settings2,
  Store,
  ArrowUpRight,
} from "lucide-react";
import { Modal } from "./ui";

const tabs = [
  { href: "/overview", label: "Home", icon: House },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/pos", label: "POS", icon: Monitor },
  { href: "/payment-requests", label: "Payments", icon: Link2 },
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
  const moreActive = pathname.startsWith("/developers") || pathname.startsWith("/settings");
  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
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
            <span>{label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`mobile-tab ${moreActive || open ? "active" : ""}`}
          onClick={onOpen}
          aria-label="More options"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span className="mobile-tab-icon">
            <MoreHorizontal size={23} />
          </span>
          <span>More</span>
        </button>
      </nav>
      {open && (
        <Modal title="Your workspace" variant="sheet" onClose={onClose}>
          <div className="mobile-more-links">
            <Link href="/developers" onClick={onClose}>
              <span className="tool-icon lilac">
                <Code2 size={22} />
              </span>
              <span>
                <strong>API & developers</strong>
                <small>Credentials, activity, and integrations</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
            <Link href="/settings" onClick={onClose}>
              <span className="tool-icon mint">
                <Settings2 size={22} />
              </span>
              <span>
                <strong>Settings</strong>
                <small>Account and workspace preferences</small>
              </span>
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <button className="button secondary mobile-signout" onClick={onLogout}>
            <LogOut size={18} />
            Sign out
          </button>
        </Modal>
      )}
    </>
  );
}
