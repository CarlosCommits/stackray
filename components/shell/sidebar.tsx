"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  PlayCircle,
  Scan,
  Bookmark,
  Settings,
  Users,
  LogOut,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth/client"

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/targets", icon: Scan, label: "Targets" },
  { href: "/runs", icon: PlayCircle, label: "Runs" },
  { href: "/saved-searches", icon: Bookmark, label: "Saved" },
]

const settingsNavItems: NavItem[] = [
  { href: "/settings/tokens", icon: Settings, label: "Settings" },
]

interface SidebarUser {
  displayName: string
  email: string
  image: string | null
  role: "admin" | "user" | "viewer"
}

function NavTooltip({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            aria-label={item.label}
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

interface SidebarProps {
  user?: SidebarUser
  canManageUsers?: boolean
  canAccessTokens?: boolean
}

function getInitials(user?: SidebarUser) {
  if (!user) {
    return "U"
  }

  const parts = user.displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return user.email.slice(0, 1).toUpperCase()
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("")
}

export function Sidebar({ user, canManageUsers = false, canAccessTokens = true }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const settingsItems = [
    ...(canAccessTokens ? settingsNavItems : []),
    ...(canManageUsers ? [{ href: "/settings/users", icon: Users, label: "Users" }] : []),
  ]

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <aside className="z-[70] flex h-screen w-16 shrink-0 flex-col items-center border-r border-[var(--gray-border)] bg-[var(--surface-dark)] py-6">
      <div className="mb-8">
        <Link href="/dashboard" aria-label="Stackray dashboard">
          <div
            aria-hidden="true"
            className="w-8 h-8 bg-[var(--accent)] rounded flex items-center justify-center font-bold text-xs text-[var(--primary-foreground)]"
          >
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

        {settingsItems.length > 0 && (
          <>
            <div className="h-px w-8 bg-[var(--gray-border)] mx-auto my-2" />

            {settingsItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <NavTooltip
                  key={item.href}
                  item={item}
                  isActive={isActive}
                />
              )
            })}
          </>
        )}
      </nav>

      <div className="mt-auto pt-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={user?.displayName ? `${user.displayName} profile` : "Profile"}
                className="size-10 flex items-center justify-center rounded-full border border-[var(--gray-border)] bg-[var(--surface-light)] overflow-hidden hover:border-[var(--accent)] transition-colors"
              >
                <Avatar className="w-full h-full">
                  <AvatarFallback className="bg-[var(--surface-light)] text-[var(--text-dim)] text-xs">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <div className="space-y-2">
                <div>
                  <p>{user?.displayName ?? "Profile"}</p>
                  {user?.email && (
                    <p className="text-[10px] text-muted-foreground">{user.email}</p>
                  )}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-3 w-3" />
                  Sign out
                </Button>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
