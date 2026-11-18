"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCwIcon className={cn("size-3.5", pending && "animate-spin")} aria-hidden="true" />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
