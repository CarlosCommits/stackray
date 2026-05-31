import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { ReleaseNoticeShell } from "./release-notice-shell"
import { GettingStartedShell } from "./getting-started-shell"
import type { StackrayReleaseMetadata, StackrayUpdateStatus } from "@/lib/contracts/app-updates"

interface AppShellUser {
  displayName: string
  email: string
  image: string | null
  role: "admin" | "user" | "viewer"
}

interface AppShellProps {
  children: React.ReactNode
  user?: AppShellUser
  canManageUsers?: boolean
  canAccessApiKeys?: boolean
  lastSeenReleaseVersion?: string | null
  gettingStartedDismissedAt?: string | null
  showGettingStarted?: boolean
  stackrayUpdateStatus?: StackrayUpdateStatus | null
  currentStackrayRelease?: StackrayReleaseMetadata | null
}

export function AppShell({
  children,
  user,
  canManageUsers,
  canAccessApiKeys,
  lastSeenReleaseVersion,
  gettingStartedDismissedAt,
  showGettingStarted,
  stackrayUpdateStatus,
  currentStackrayRelease,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--gray-charcoal)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-[var(--accent)] focus:text-[var(--primary-foreground)] focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Sidebar user={user} canManageUsers={canManageUsers} canAccessApiKeys={canAccessApiKeys} />
      <main id="main-content" tabIndex={-1} className="scanline-grid relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header stackrayUpdateStatus={stackrayUpdateStatus ?? null} />
        {user && (
          <ReleaseNoticeShell
            lastSeenReleaseVersion={lastSeenReleaseVersion ?? null}
            currentRelease={currentStackrayRelease ?? null}
          />
        )}
        {user && canManageUsers && showGettingStarted && !gettingStartedDismissedAt && (
          <GettingStartedShell />
        )}
        <div className="flex-1 overflow-y-auto" data-app-scroll-container="true">
          <div className="p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
