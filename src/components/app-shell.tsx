"use client";
import { useUiText } from "@/lib/use-ui-text";
import { useUrlState } from "@/lib/use-url-state";

import { BusinessToolLink as Link } from "@/components/business-tool-link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Code2,
  LayoutDashboard,
  LogOut,
  Calculator as Monitor,
  Settings2,
  ShieldCheck,
  Store,
  Link2,
  FlaskConical,
} from "lucide-react";
import { LanguageSwitch } from "./language-switch";
import { Brand } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { demoMode } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { MobileNavigation } from "./mobile-navigation";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/stores", label: "Online Stores", icon: Store },
  { href: "/pos", label: "POS", icon: Monitor },
  { href: "/payment-requests", label: "Payment links", icon: Link2 },
  { href: "/developers", label: "API", icon: Code2 },
];
export function AppShell({ children }: { children: ReactNode }) {
  const uiText = useUiText();

  const pathname = usePathname();
  const { values } = useUrlState();
  const activePath =
    /^\/stores\/\d+\/pos$/.test(pathname) ||
    (pathname === "/stores" && values.get("mode") === "pos")
      ? "/pos"
      : pathname;
  const [open, setOpen] = useState(false);
  const { logout, notify } = useWorkspace();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/overview" aria-label={uiText("Fondeka Business home")}>
            <Brand />
          </Link>
        </div>
        <Link className="workspace-switch" href="/settings" onClick={() => setOpen(false)}>
          <span className="workspace-avatar">
            {uiText("F")}
            <span />
          </span>
          <span>
            <strong>{uiText("Business workspace")}</strong>
            <small>{demoMode ? uiText("Demo account") : uiText("Your Fondeka account")}</small>
          </span>
          <ChevronDown size={15} />
        </Link>
        <p className="nav-caption">{uiText("WORKSPACE")}</p>
        <nav aria-label={uiText("Main navigation")}>
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${activePath.startsWith(href) ? "active" : ""}`}
              aria-current={activePath.startsWith(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{uiText(label)}</span>
              {activePath.startsWith(href) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <BookOpen size={19} />
            </span>
            <strong>{uiText("Build your next integration.")}</strong>
            <p>{uiText("Connect your business to the Fondeka API.")}</p>
            <Link href="/developers#integration-guide" onClick={() => setOpen(false)}>
              {uiText("Explore the guide")}
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <Link
            href="/settings"
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            <Settings2 size={18} />
            {uiText("Settings")}
          </Link>
          <button
            className="profile-button"
            onClick={() => {
              void logout().catch(() =>
                notify(uiText("We couldn’t sign you out. Please try again.")),
              );
            }}
          >
            <span className="profile-avatar">{demoMode ? "DK" : "FB"}</span>
            <span>
              <strong>{demoMode ? uiText("Demo workspace") : uiText("Fondeka Business")}</strong>
              <small>
                {demoMode ? uiText("Explore with sample data") : uiText("Sign out of your account")}
              </small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Link
            href="/overview"
            className="mobile-app-brand"
            aria-label={uiText("Fondeka Business home")}
          >
            <Brand />
          </Link>
          <div className="breadcrumb">
            <span>{uiText("Workspace")}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {uiText(
                navigation.find((item) => activePath.startsWith(item.href))?.label ?? "Settings",
              )}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`environment-pill ${demoMode ? "demo" : "live"}`}>
              {demoMode ? <FlaskConical size={13} /> : <ShieldCheck size={13} />}{" "}
              {demoMode ? uiText("Demo mode") : uiText("Live workspace")}
            </span>
            <Link href="/developers" className="topbar-docs">
              {uiText("Developer guide")}
              <ArrowUpRight size={14} />
            </Link>
            <span className="topbar-divider" />
            <LanguageSwitch />
            <ThemeToggle />
          </div>
        </header>
        <main id="main-content" className="main-content">
          {demoMode && (
            <div className="demo-banner">
              <FlaskConical size={15} />
              <span>
                {uiText(
                  "You’re exploring a demo workspace. All data is fictional and actions stay in this browser.",
                )}
              </span>
              <Link href="/settings">
                {uiText("Manage demo")}
                <ArrowRightIcon />
              </Link>
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>
            © {new Date().getFullYear()}
            {uiText("Fondeka")}
          </span>
          <span>
            <ShieldCheck size={13} />
            {uiText("Your business, connected.")}
          </span>
        </footer>
      </div>
      <MobileNavigation
        pathname={activePath}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        onLogout={() => {
          void logout().catch(() => notify(uiText("We couldn’t sign you out. Please try again.")));
        }}
      />
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={13} />;
}
