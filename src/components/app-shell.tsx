"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Code2,
  LayoutDashboard,
  LogOut,
  Monitor,
  Settings2,
  ShieldCheck,
  Store,
  Link2,
  FlaskConical,
} from "lucide-react";
import { Brand } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { demoMode } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { MobileNavigation } from "./mobile-navigation";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/pos", label: "Point of sale", icon: Monitor },
  { href: "/payment-requests", label: "Payment links", icon: Link2 },
  { href: "/developers", label: "API & developers", icon: Code2 },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { logout, notify } = useWorkspace();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/overview" aria-label="Fondeka Business home">
            <Brand />
          </Link>
        </div>
        <Link className="workspace-switch" href="/settings" onClick={() => setOpen(false)}>
          <span className="workspace-avatar">
            F<span />
          </span>
          <span>
            <strong>Business workspace</strong>
            <small>{demoMode ? "Demo account" : "Your Fondeka account"}</small>
          </span>
          <ChevronDown size={15} />
        </Link>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${pathname.startsWith(href) ? "active" : ""}`}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {pathname.startsWith(href) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <BookOpen size={19} />
            </span>
            <strong>Build your next integration.</strong>
            <p>Connect your business to the Fondeka API.</p>
            <Link href="/developers#integration-guide" onClick={() => setOpen(false)}>
              Explore the guide <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            Settings
          </Link>
          <button
            className="profile-button"
            onClick={() => {
              void logout().catch(() => notify("We couldn’t sign you out. Please try again."));
            }}
          >
            <span className="profile-avatar">{demoMode ? "DK" : "FB"}</span>
            <span>
              <strong>{demoMode ? "Demo workspace" : "Fondeka Business"}</strong>
              <small>{demoMode ? "Explore with sample data" : "Sign out of your account"}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Link href="/overview" className="mobile-app-brand" aria-label="Fondeka Business home">
            <Brand />
          </Link>
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {navigation.find((item) => pathname.startsWith(item.href))?.label ?? "Settings"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`environment-pill ${demoMode ? "demo" : "live"}`}>
              {demoMode ? <FlaskConical size={13} /> : <ShieldCheck size={13} />}{" "}
              {demoMode ? "Demo mode" : "Live workspace"}
            </span>
            <Link href="/developers" className="topbar-docs">
              Developer guide <ArrowUpRight size={14} />
            </Link>
            <span className="topbar-divider" />
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" className="main-content">
          {demoMode && (
            <div className="demo-banner">
              <FlaskConical size={15} />
              <span>
                You’re exploring a demo workspace. All data is fictional and actions stay in this
                browser.
              </span>
              <Link href="/settings">
                Manage demo <ArrowRightIcon />
              </Link>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Fondeka</span>
          <span>
            <ShieldCheck size={13} />
            Your business, connected.
          </span>
        </footer>
      </div>
      <MobileNavigation
        pathname={pathname}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onLogout={() => {
          void logout().catch(() => notify("We couldn’t sign you out. Please try again."));
        }}
      />
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={13} />;
}
