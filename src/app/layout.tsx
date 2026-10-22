import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { defaultTheme, themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fondeka Business", template: "%s · Fondeka Business" },
  description:
    "One workspace for your stores, point of sale, payment requests, and Fondeka API integrations.",
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script id="fondeka-theme" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
