"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, MenuIcon, ShieldCheckIcon, XIcon } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToolBySlug } from "@/lib/pdf/tools";

function useCurrentTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname === "/admin") return "System status";
  const tool = getToolBySlug(pathname.replace(/^\//, ""));
  return tool?.name ?? "Workspace";
}

export function AppShell({
  appName,
  appVersion,
  children,
}: {
  appName: string;
  appVersion: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const currentTitle = useCurrentTitle(pathname);

  // Close the drawer for browser back/forward navigation. In-app links close it
  // through `onNavigate`, so no state is set during an effect body.
  React.useEffect(() => {
    const handlePopState = () => setMobileNavOpen(false);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <TooltipProvider>
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="bg-card/40 hidden border-r backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="p-4">
            <Link
              href="/dashboard"
              className="focus-visible:ring-ring rounded-lg outline-none focus-visible:ring-2"
            >
              <Wordmark appName={appName} />
            </Link>
          </div>
          <div className="min-h-0 flex-1">
            <SidebarNav />
          </div>
        </aside>

        <div className="flex min-h-dvh min-w-0 flex-col">
          <header className="bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-5">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <MenuIcon className="size-5" />
            </Button>

            <div className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="text-muted-foreground hidden sm:inline">Workspace</span>
              <ChevronRightIcon
                className="text-muted-foreground/60 hidden size-3.5 sm:inline"
                aria-hidden="true"
              />
              <span className="truncate font-medium">{currentTitle}</span>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/admin">
                  <ShieldCheckIcon className="size-4" aria-hidden="true" />
                  System status
                </Link>
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main id="main-content" className="min-w-0 flex-1">
            {children}
          </main>

          <footer className="border-t px-4 py-5 sm:px-6">
            <div className="text-muted-foreground mx-auto max-w-6xl space-y-2 text-[11px]">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Confidential files are processed on company infrastructure. Nothing is sent to
                  third-party AI services or analytics.
                </p>
                <p className="shrink-0 font-mono">v{appVersion}</p>
              </div>
              <div className="border-border/60 flex flex-col gap-1 border-t pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-foreground/70">
                  Developed by <span className="font-medium">Sanjay Nayak</span> · All rights
                  reserved
                </p>
                <p>
                  Made with{" "}
                  <span role="img" aria-label="love">
                    ❤️
                  </span>{" "}
                  in India · For internal use only
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 h-dvh w-[19rem] max-w-[86vw] translate-x-0 translate-y-0 gap-0 rounded-none rounded-r-2xl border-r p-0"
        >
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Browse the available PDF tools and system status.
          </DialogDescription>

          <div className="flex items-center justify-between gap-2 p-4 pb-2">
            <Wordmark appName={appName} />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpen(false)}
            >
              <XIcon className="size-5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
