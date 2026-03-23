"use client"

import { usePathname } from "next/navigation"

interface HeaderProps {
  workspace?: string
  showStatus?: boolean
}

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/history": "History",
  "/search": "Search",
  "/saved-searches": "Saved Searches",
  "/settings/tokens": "Tokens",
  "/settings/workspace": "Workspace",
  "/scans/new": "New Scan",
}

export function Header({ workspace = "Workspace", showStatus = true }: HeaderProps) {
  const pathname = usePathname()
  const title =
    routeTitles[pathname] ??
    (pathname.startsWith("/scans/") ? "Scan Detail" : pathname.startsWith("/targets/") ? "Target Timeline" : "Dashboard")

  return (
    <header className="h-14 border-b border-[var(--gray-border)] bg-[var(--surface-dark)]/90 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h1 className="font-[var(--font-heading)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-dim)]">
          {workspace} / <span className="text-[var(--accent)]">{title}</span>
        </h1>
        {showStatus && (
          <div className="flex gap-1 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[10px] font-mono text-[var(--accent)]">system_active</span>
          </div>
        )}
      </div>

      <div className="flex items-center text-[var(--text-dim)]">
        <span className="text-[10px] font-mono">v0.1.0-alpha</span>
      </div>
    </header>
  )
}
