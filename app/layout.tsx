import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ClickFireworks } from "@/components/effects/click-fireworks";
import { Toaster } from "@/components/ui/sonner";
import { getPublicConfig } from "@/lib/config/env";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const { appName } = getPublicConfig();

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Internal, self-hosted PDF workspace for company documents.",
  applicationName: appName,
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141418" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const publicConfig = getPublicConfig();

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell appName={publicConfig.appName} appVersion={publicConfig.appVersion}>
            {children}
          </AppShell>
          <ClickFireworks />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
