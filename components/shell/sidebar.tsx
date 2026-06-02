"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogOut, Menu, X } from "lucide-react"
import type { ComponentType, MouseEvent } from "react"
import { useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
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
  { href: "/runs", icon: NAVIGATION_VISUALS.runs.icon, label: "Runs", tone: NAVIGATION_VISUALS.runs.tone },
  { href: "/technology-compare", icon: NAVIGATION_VISUALS.technologies.icon, label: "Tech Compare", tone: NAVIGATION_VISUALS.technologies.tone },
  { href: "/schedules", icon: NAVIGATION_VISUALS.schedules.icon, label: "Schedules", tone: NAVIGATION_VISUALS.schedules.tone },
]

const settingsNavItems: NavItem[] = [
  { href: "/settings/api-keys", icon: NAVIGATION_VISUALS.settings.icon, label: "API Keys", tone: NAVIGATION_VISUALS.settings.tone },
]

interface SidebarUser {
  displayName: string
  email: string
  image: string | null
  role: "admin" | "user" | "viewer"
}

function NavTooltip({ item, isActive, onNavigate }: { item: NavItem; isActive: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.detail > 0) {
      event.currentTarget.blur()
    }

    onNavigate()
  }

  return (
    <Link
      href={item.href}
      aria-label={item.label}
      onClick={handleClick}
      className={cn(
        "flex h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
        isActive
          ? "text-[var(--accent)] bg-[var(--accent)]/10"
          : "text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[var(--surface-light)]"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="max-w-40 whitespace-nowrap opacity-100 transition-[max-width,opacity] duration-150 md:max-w-0 md:opacity-0 md:group-hover/sidebar:max-w-40 md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-40 md:group-focus-within/sidebar:opacity-100">
        {item.label}
      </span>
    </Link>
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const settingsItems = [
    ...(canAccessApiKeys ? settingsNavItems : []),
    ...(canManageUsers ? [{ href: "/settings/users", icon: NAVIGATION_VISUALS.users.icon, label: "Users", tone: NAVIGATION_VISUALS.users.tone }] : []),
  ]

  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mobileOpen])

  const handleSignOut = async () => {
    await authClient.signOut()
    setMobileOpen(false)
    push("/")
    refresh()
  }

  const handleBrandClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.detail > 0) {
      event.currentTarget.blur()
    }

    setMobileOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        size="icon-lg"
        variant="outline"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        className="fixed left-3 top-2.5 z-[75] border-[var(--gray-border)] bg-[var(--surface-dark)] text-[var(--foreground)] shadow-[0_12px_32px_rgba(0,0,0,0.32)] hover:bg-[var(--surface-light)] md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu data-icon="inline-start" aria-hidden="true" />
      </Button>

      <button
        type="button"
        aria-label="Close navigation overlay"
        className={cn(
          "fixed inset-0 z-[78] bg-black/35 opacity-0 transition-opacity duration-150 md:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none"
        )}
        onClick={() => setMobileOpen(false)}
      />

      <div className="hidden h-screen w-16 shrink-0 md:block" aria-hidden="true" />

      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-[80] flex h-svh w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden border-r border-[var(--gray-border)] bg-[var(--surface-dark)] px-3 pb-5 pt-2 shadow-[18px_0_50px_rgba(0,0,0,0.38)] transition-[width,transform,box-shadow] duration-150 ease-out md:z-[70] md:w-16 md:max-w-none md:translate-x-0 md:shadow-none md:hover:w-64 md:hover:shadow-[18px_0_52px_rgba(0,0,0,0.28)] md:focus-within:w-64 md:focus-within:shadow-[18px_0_52px_rgba(0,0,0,0.28)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="mb-7 flex h-11 items-center justify-between gap-3">
          <Link
            href="/dashboard"
            aria-label="Stackray dashboard"
            className="flex min-w-0 items-center gap-3 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            onClick={handleBrandClick}
          >
            <Image
              src="/stackray-logo-rendered.webp"
              alt=""
              width={40}
              height={40}
              priority
              className="shrink-0 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
            />
            <span className="max-w-36 whitespace-nowrap font-heading text-base font-semibold text-[var(--accent)] opacity-100 transition-[max-width,opacity] duration-150 md:max-w-0 md:opacity-0 md:group-hover/sidebar:max-w-36 md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-36 md:group-focus-within/sidebar:opacity-100">
              Stackray
            </span>
          </Link>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Close navigation"
            className="text-[var(--text-dim)] hover:bg-[var(--surface-light)] hover:text-[var(--foreground)] md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X data-icon="inline-start" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Primary navigation">
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <NavTooltip
                key={item.href}
                item={item}
                isActive={isActive}
                onNavigate={() => setMobileOpen(false)}
              />
            )
          })}

          {settingsItems.length > 0 ? (
            <>
              <Separator className="my-2 bg-[var(--gray-border)] md:w-10 md:group-hover/sidebar:w-full md:group-focus-within/sidebar:w-full" />

              {settingsItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <NavTooltip
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    onNavigate={() => setMobileOpen(false)}
                  />
                )
              })}
            </>
          ) : null}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <button
            type="button"
            aria-label={user?.displayName ? `${user.displayName} profile` : "Profile"}
            className="flex h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-md px-0 text-left transition-colors hover:bg-[var(--surface-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Avatar className="size-10 shrink-0 border border-[var(--gray-border)] bg-[var(--surface-light)]">
              <AvatarFallback className="bg-[var(--surface-light)] text-xs text-[var(--text-dim)]">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 max-w-44 flex-col opacity-100 transition-[max-width,opacity] duration-150 md:max-w-0 md:opacity-0 md:group-hover/sidebar:max-w-44 md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-44 md:group-focus-within/sidebar:opacity-100">
              <span className="truncate text-sm font-semibold leading-5 text-[var(--foreground)]">
                {user?.displayName ?? "Profile"}
              </span>
              {user?.email ? (
                <span className="truncate text-xs text-[var(--text-dim)]">{user.email}</span>
              ) : null}
            </span>
          </button>

          <Button
            size="sm"
            variant="outline"
            className="h-9 w-fit max-w-full justify-start gap-3 overflow-hidden border-[var(--gray-border)] bg-[var(--surface-mid)] px-2.5 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--surface-light)] hover:text-[var(--foreground)]"
            onClick={handleSignOut}
          >
            <LogOut className="shrink-0 text-[var(--text-dim)]" aria-hidden="true" />
            <span className="max-w-36 opacity-100 transition-[max-width,opacity] duration-150 md:max-w-0 md:opacity-0 md:group-hover/sidebar:max-w-36 md:group-hover/sidebar:opacity-100 md:group-focus-within/sidebar:max-w-36 md:group-focus-within/sidebar:opacity-100">
              Sign out
            </span>
          </Button>
        </div>
      </aside>
    </>
  )
}
