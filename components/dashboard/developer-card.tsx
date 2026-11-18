import { BadgeCheckIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DeveloperCard() {
  const year = new Date().getFullYear();

  return (
    <Card className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-20 -right-16 size-44 rounded-full opacity-20 blur-3xl"
        style={{ backgroundImage: "linear-gradient(120deg, var(--brand-from), var(--brand-to))" }}
        aria-hidden="true"
      />
      <CardHeader className="relative">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-[4.5rem]" />
          <div className="min-w-0">
            <CardDescription className="text-[10px] font-medium tracking-[0.14em] uppercase">
              Developed by
            </CardDescription>
            <CardTitle className="truncate">Sanjay Nayak</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-3">
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          Creator and maintainer of this workspace. Built to keep every document task fast, private
          and on company infrastructure.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">
            Made with{" "}
            <span role="img" aria-label="love">
              ❤️
            </span>{" "}
            in India
          </Badge>
          <Badge variant="outline">
            <BadgeCheckIcon aria-hidden="true" />
            For internal use only
          </Badge>
        </div>
        <p className="text-muted-foreground border-border/60 border-t pt-2.5 text-[11px]">
          © {year} Sanjay Nayak · All rights reserved
        </p>
      </CardContent>
    </Card>
  );
}
