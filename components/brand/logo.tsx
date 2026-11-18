import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "brand-gradient inline-grid size-9 shrink-0 place-items-center rounded-[10px] text-white shadow-[0_4px_12px_-4px_oklch(0.5_0.2_280/0.7)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5">
        <path
          d="M6.75 3.75h6.5l4.5 4.5v11a1 1 0 0 1-1 1H6.75a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M13.25 3.75v4.5h4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M9 13h6M9 16.25h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
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
