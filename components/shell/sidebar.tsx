"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  History,
  Search,
  Bookmark,
  Settings,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/history", icon: History, label: "History" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/saved-searches", icon: Bookmark, label: "Saved" },
]

const settingsNavItems: NavItem[] = [
  { href: "/settings/tokens", icon: Settings, label: "Settings" },
]

function NavTooltip({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "size-10 flex items-center justify-center rounded-md transition-colors duration-200",
              isActive
                ? "text-[var(--accent)] bg-[var(--accent)]/10"
                : "text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--surface-light)]"
            )}
          >
            <Icon className="w-5 h-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{item.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="z-[70] flex h-screen w-16 shrink-0 flex-col items-center border-r border-[var(--gray-border)] bg-[var(--surface-dark)] py-6">
      <div className="mb-8">
        <Link href="/dashboard">
          <div className="w-8 h-8 bg-[var(--accent)] rounded flex items-center justify-center font-bold text-xs text-[var(--primary-foreground)]">
            S
          </div>
        </Link>
      </div>

      <nav className="flex flex-col gap-2 flex-1">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <NavTooltip
              key={item.href}
              item={item}
              isActive={isActive}
            />
          )
        })}

        <div className="h-px w-8 bg-[var(--gray-border)] mx-auto my-2" />

        {settingsNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <NavTooltip
              key={item.href}
              item={item}
              isActive={isActive}
            />
          )
        })}
      </nav>

      <div className="mt-auto pt-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="size-10 flex items-center justify-center rounded-full border border-[var(--gray-border)] bg-[var(--surface-light)] overflow-hidden hover:border-[var(--accent)] transition-colors">
                <Avatar className="w-full h-full">
                  <AvatarFallback className="bg-[var(--surface-light)] text-[var(--text-dim)] text-xs">
                    U
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Profile</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
