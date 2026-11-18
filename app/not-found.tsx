import Link from "next/link";
import { FileQuestionIcon, HomeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-6 py-20">
      <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-xl">
        <FileQuestionIcon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        This tool may not be available yet. Browse the dashboard to see what is live.
      </p>
      <Button asChild variant="brand">
        <Link href="/dashboard">
          <HomeIcon className="size-4" />
          Back to dashboard
        </Link>
      </Button>
    </div>
  );
}
