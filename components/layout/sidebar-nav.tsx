"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, LayoutDashboardIcon, ShieldCheckIcon } from "lucide-react";

import { ToolIcon } from "@/components/pdf/tool-icon";
import { Badge } from "@/components/ui/badge";
import { getNavigationGroups } from "@/lib/pdf/tools";
import { cn } from "@/lib/utils";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = getNavigationGroups()
    .map((group) => ({
      ...group,
      tools: group.tools.filter((tool) => tool.status === "available"),
    }))
    .filter((group) => group.tools.length > 0);

  const isActive = (href: string) => pathname === href;

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-full scrollbar-thin flex-col gap-6 overflow-y-auto px-3 pb-4"
    >
      <div className="space-y-1">
        <NavLink
          href="/dashboard"
          active={isActive("/dashboard")}
          onNavigate={onNavigate}
          icon={<LayoutDashboardIcon className="size-4" aria-hidden="true" />}
        >
          Dashboard
        </NavLink>
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="text-muted-foreground/80 mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.tools.map((tool) => (
                <li key={tool.id}>
                  <NavLink
                    href={`/${tool.slug}`}
                    active={isActive(`/${tool.slug}`)}
                    onNavigate={onNavigate}
                    icon={<ToolIcon name={tool.icon} className="size-4" />}
                  >
                    {tool.name}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-1 border-t pt-4">
        <NavLink
          href="/admin"
          active={isActive("/admin")}
          onNavigate={onNavigate}
          icon={<ShieldCheckIcon className="size-4" aria-hidden="true" />}
        >
          <span className="flex w-full items-center justify-between gap-2">
            System status
            <Badge variant="muted" className="text-[10px]">
              Admin
            </Badge>
          </span>
        </NavLink>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {active ? (
        <span className="bg-primary absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
      ) : null}
      <span
        className={cn(
          active ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {active ? <ChevronRightIcon className="size-3.5 opacity-50" aria-hidden="true" /> : null}
    </Link>
  );
}
