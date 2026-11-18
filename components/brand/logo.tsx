import Image from "next/image";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 ring-1 ring-black/5",
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/logo.jpg"
        alt=""
        width={387}
        height={195}
        preload
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function Wordmark({ appName, className }: { appName: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Logo />
      <span className="min-w-0">
        <span className="block truncate text-[15px] leading-tight font-semibold tracking-tight">
          {appName}
        </span>
        <span className="text-muted-foreground block text-[11px] leading-tight">
          Internal document tools
        </span>
      </span>
    </span>
  );
}
