"use client"

import { usePathname } from "next/navigation"
import { Save, SlidersHorizontal } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

      <div className="flex items-center gap-4 text-[var(--text-dim)]">
        <span className="text-[10px] font-mono">v0.1.0-alpha</span>
        <div className="h-4 w-px bg-[var(--gray-border)]" />
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Save className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save Layout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <SlidersHorizontal className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="w-8 h-8 rounded-full border border-[var(--gray-border)] bg-[var(--surface-light)] overflow-hidden">
          <Avatar className="w-full h-full">
            <AvatarFallback className="bg-[var(--surface-light)] text-[var(--text-dim)] text-xs">
              U
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
