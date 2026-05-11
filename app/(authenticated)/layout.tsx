import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { getAppSession } from "@/lib/session/app-session"
import { canAccessApiTokens, canManageUsers } from "@/lib/authorization/authz"
import { isBootstrapOpen, isInitialAdminOnboardingPhase } from "@/lib/server/bootstrap/service"
import { getUserProductState } from "@/lib/server/product-state/service"
import { getStackrayReleaseByVersion, getStackrayUpdateStatus } from "@/lib/server/app-updates/service"
import { APP_VERSION } from "@/lib/version"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    if (await isBootstrapOpen()) {
      redirect("/setup")
    }

    redirect("/")
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  const canManageUsersAccess = canManageUsers(session)
  const [productState, showGettingStarted, stackrayUpdateStatus, currentStackrayRelease] = await Promise.all([
    getUserProductState(session),
    canManageUsersAccess ? isInitialAdminOnboardingPhase() : Promise.resolve(false),
    canManageUsersAccess ? getStackrayUpdateStatus() : Promise.resolve(null),
    getStackrayReleaseByVersion(APP_VERSION),
  ])

  return (
    <AppShell
      user={{
        email: session.user.email,
        displayName: session.user.displayName,
        image: session.user.image,
        role: session.user.role,
      }}
      canManageUsers={canManageUsersAccess}
      canAccessTokens={canAccessApiTokens(session)}
      lastSeenReleaseVersion={productState.lastSeenReleaseVersion}
      gettingStartedDismissedAt={productState.gettingStartedDismissedAt}
      showGettingStarted={showGettingStarted}
      stackrayUpdateStatus={stackrayUpdateStatus}
      currentStackrayRelease={currentStackrayRelease}
    >
      {children}
    </AppShell>
  )
}
