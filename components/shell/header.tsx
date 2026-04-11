"use client"

import { usePathname } from "next/navigation"
import { APP_VERSION } from "@/lib/version"

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/runs": "Runs",
  "/targets": "Targets",
  "/saved-searches": "Saved Searches",
  "/settings/tokens": "Tokens",
  "/settings/api-docs": "API Docs",
  "/settings/users": "Users",
  "/scans/new": "New Scan",
}

export function Header() {
  const pathname = usePathname()
  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/scans/") ? "Scan Detail" : pathname.startsWith("/targets/") ? "Target Timeline" : "Dashboard")

  return (
    <header className="h-14 border-b border-[var(--gray-border)] bg-[var(--surface-dark)]/90 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h1 className="font-[var(--font-heading)] text-lg font-semibold text-[var(--accent)]">
          {title}
        </h1>
      </div>

      <div className="flex items-center text-[var(--text-dim)]">
        <span className="text-[10px] font-mono">v{APP_VERSION}</span>
      </div>
    </header>
  )
}
