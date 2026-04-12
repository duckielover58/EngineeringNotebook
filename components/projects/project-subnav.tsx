"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/database";

const links = (projectId: string, status: ProjectStatus) => {
  const base = [
    { href: `/projects/${projectId}`, label: "Overview" },
    { href: `/projects/${projectId}/logs`, label: "Daily log" },
    { href: `/projects/${projectId}/technicals`, label: "Technicals" },
    { href: `/projects/${projectId}/final`, label: "Final sketches" },
    { href: `/projects/${projectId}/export`, label: "Export PDF" },
  ];
  if (status === "setup") {
    return [{ href: `/projects/${projectId}/setup`, label: "Setup wizard" }, ...base];
  }
  return base;
};

export function ProjectSubnav({ projectId, status }: { projectId: string; status: ProjectStatus }) {
  const pathname = usePathname();
  const items = links(projectId, status);
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 text-sm">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "rounded-md px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            pathname === l.href && "bg-muted text-foreground"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
