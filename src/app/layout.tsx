import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { defaultTheme, themeInitScript } from "@/lib/theme";
import { languageInitScript } from "@/lib/locale";
import { ThemeController } from "@/components/theme-controller";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Fondeka Business", template: "%s · Fondeka Business" },
  description:
    "One workspace for your stores, point of sale, payment requests, and Fondeka API integrations.",
  robots: { index: false, follow: false },
  other: { google: "notranslate" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      translate="no"
      data-theme={defaultTheme}
      data-scroll-behavior="smooth"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="fondeka-language"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: languageInitScript }}
        />
        <Script
          id="fondeka-theme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        <ThemeController />
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
