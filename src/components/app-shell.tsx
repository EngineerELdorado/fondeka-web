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
import { ApiEnvironmentSwitch } from "./api-environment-switch";
import { Brand } from "./ui";
import { useWorkspace } from "./workspace-provider";
import { demoMode } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { MobileNavigation } from "./mobile-navigation";
import { DeveloperSectionLinks } from "./developer-section-links";
import { WorkspaceBusinessId } from "./workspace-business-id";
import { developerSections } from "@/lib/developer-navigation";

const navigation = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/payment-requests", label: "Payment links", icon: Link2 },
  { href: "/stores", label: "Online Stores", icon: Store },
  { href: "/stores?view=shared", label: "Stores shared with me", icon: Store },
  { href: "/pos", label: "POS", icon: Monitor },
  { href: "/developers", label: "Payments API", icon: Code2 },
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
  const sharedActive =
    pathname === "/stores" && values.get("view") === "shared" && values.get("mode") !== "pos";
  const activeLink = (href: string) =>
    href === "/stores?view=shared"
      ? sharedActive
      : href === "/stores"
        ? activePath.startsWith(href) && !sharedActive
        : activePath.startsWith(href);
  const [open, setOpen] = useState(false);
  const workspaceTone = activePath.startsWith("/pos")
    ? "amber"
    : activePath.startsWith("/stores")
      ? "violet"
      : activePath.startsWith("/developers")
        ? "blue"
        : "green";
  const [developerExpansion, setDeveloperExpansion] = useState<{ path: string; open: boolean }>();
  const developersOpen =
    developerExpansion?.path === pathname
      ? developerExpansion.open
      : pathname.startsWith("/developers");
  const { logout, notify } = useWorkspace();
  return (
    <div className="app-shell" data-workspace-tone={workspaceTone}>
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
          <span className="workspace-identity">
            <strong>{uiText("My workspace")}</strong>
            <WorkspaceBusinessId />
          </span>
          <ChevronDown size={15} />
        </Link>
        <p className="nav-caption">{uiText("WORKSPACE")}</p>
        <nav aria-label={uiText("Main navigation")}>
          {navigation.map(({ href, label, icon: Icon }) =>
            href === "/developers" ? (
              <div key={href} className="developer-nav-group">
                <button
                  type="button"
                  className={`nav-item developer-nav-parent ${activePath.startsWith(href) ? "active" : ""}`}
                  aria-expanded={developersOpen}
                  aria-controls="developer-submenu"
                  onClick={() => setDeveloperExpansion({ path: pathname, open: !developersOpen })}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span className="developer-nav-label">{uiText(label)}</span>
                  <span className="developer-nav-chevron" aria-hidden="true">
                    <ChevronDown size={16} strokeWidth={2.5} />
                  </span>
                </button>
                <div id="developer-submenu" hidden={!developersOpen}>
                  <DeveloperSectionLinks pathname={pathname} onNavigate={() => setOpen(false)} />
                </div>
              </div>
            ) : (
              <Link
                key={href}
                href={href}
                className={`nav-item ${activeLink(href) ? "active" : ""}`}
                aria-current={activeLink(href) ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                <span>{uiText(label)}</span>
                {activeLink(href) && <span className="nav-active-dot" />}
              </Link>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">
              <BookOpen size={19} />
            </span>
            <strong>{uiText("Build your next integration.")}</strong>
            <p>{uiText("Connect your business to the Fondeka API.")}</p>
            <Link href="/developers/guides" onClick={() => setOpen(false)}>
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
              {uiText(navigation.find((item) => activeLink(item.href))?.label ?? "Settings")}
            </strong>
            {developerSections.find((section) => section.href === pathname) && (
              <>
                <span className="breadcrumb-slash">/</span>
                <strong>
                  {uiText(developerSections.find((section) => section.href === pathname)!.label)}
                </strong>
              </>
            )}
          </div>
          <div className="topbar-right">
            {pathname.startsWith("/developers") && <ApiEnvironmentSwitch />}
            <Link href="/developers/guides" className="topbar-docs">
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
