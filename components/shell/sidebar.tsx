"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogOut } from "lucide-react"
import type { ComponentType } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { NAVIGATION_VISUALS, type NavigationToneKey } from "@/components/navigation-theme"
import { authClient } from "@/lib/auth/client"

interface NavItem {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  tone: NavigationToneKey
}

const mainNavItems: NavItem[] = [
  { href: "/dashboard", icon: NAVIGATION_VISUALS.dashboard.icon, label: "Dashboard", tone: NAVIGATION_VISUALS.dashboard.tone },
  { href: "/targets", icon: NAVIGATION_VISUALS.targets.icon, label: "Targets", tone: NAVIGATION_VISUALS.targets.tone },
  { href: "/technology-compare", icon: NAVIGATION_VISUALS.technologies.icon, label: "Compare", tone: NAVIGATION_VISUALS.technologies.tone },
  { href: "/runs", icon: NAVIGATION_VISUALS.runs.icon, label: "Runs", tone: NAVIGATION_VISUALS.runs.tone },
  { href: "/schedules", icon: NAVIGATION_VISUALS.schedules.icon, label: "Schedules", tone: NAVIGATION_VISUALS.schedules.tone },
]

const settingsNavItems: NavItem[] = [
  { href: "/settings/api-keys", icon: NAVIGATION_VISUALS.settings.icon, label: "Settings", tone: NAVIGATION_VISUALS.settings.tone },
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
            <Icon className="size-5" />
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
  canAccessApiKeys?: boolean
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

export function Sidebar({ user, canManageUsers = false, canAccessApiKeys = true }: SidebarProps) {
  const { push, refresh } = useRouter()
  const pathname = usePathname()
  const settingsItems = [
    ...(canAccessApiKeys ? settingsNavItems : []),
    ...(canManageUsers ? [{ href: "/settings/users", icon: NAVIGATION_VISUALS.users.icon, label: "Users", tone: NAVIGATION_VISUALS.users.tone }] : []),
  ]

  const handleSignOut = async () => {
    await authClient.signOut()
    push("/")
    refresh()
  }

  return (
    <aside className="z-[70] flex h-screen w-16 shrink-0 flex-col items-center border-r border-[var(--gray-border)] bg-[var(--surface-dark)] pb-6 pt-2">
      <div className="mb-8">
        <Link href="/dashboard" aria-label="Stackray dashboard">
          <Image
            src="/stackray-logo-rendered.webp"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
          />
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
            <TooltipContent
              side="right"
              sideOffset={10}
              className="block min-w-52 rounded-lg p-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)]"
            >
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold leading-5 text-[var(--foreground)]">
                    {user?.displayName ?? "Profile"}
                  </p>
                  {user?.email && (
                    <p className="max-w-44 truncate text-xs text-[var(--text-dim)]">{user.email}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-full justify-start border-[var(--gray-border)] bg-[var(--surface-mid)] text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface-light)] hover:text-[var(--foreground)]"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 size-4 text-[var(--text-dim)]" />
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
