"use client";

import Link from "next/link";
import { HomeIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-6 py-20">
      <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
        Something broke
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">This page could not be loaded</h1>
      <p className="text-muted-foreground text-sm">
        The error was logged on the server. Try again, or return to the dashboard.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="brand">
          <RefreshCwIcon className="size-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">
            <HomeIcon className="size-4" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
