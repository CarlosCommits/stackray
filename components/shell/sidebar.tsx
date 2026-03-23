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

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-16 flex flex-col items-center py-6 bg-[var(--surface-dark)] border-r border-[var(--gray-border)] z-[70]">
      <div className="mb-8">
        <Link href="/dashboard">
          <div className="w-8 h-8 bg-[var(--accent)] rounded flex items-center justify-center font-bold text-xs text-[var(--primary-foreground)]">
            S
          </div>
        </Link>
      </div>

      <nav className="flex flex-col gap-6">
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors duration-200",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-dim)] hover:text-[var(--accent)]"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          )
        })}

        <div className="h-px w-8 bg-[var(--gray-border)] mx-auto my-2" />

        {settingsNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors duration-200",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-dim)] hover:text-[var(--accent)]"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
