import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { getAppSession } from "@/lib/session/app-session"
import { canAccessApiTokens, canManageUsers } from "@/lib/authorization/authz"
import { isBootstrapOpen, isInitialAdminOnboardingPhase } from "@/lib/server/bootstrap/service"
import { getUserProductState } from "@/lib/server/product-state/service"

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

    redirect("/sign-in")
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  const canManageUsersAccess = canManageUsers(session)
  const [productState, showGettingStarted] = await Promise.all([
    getUserProductState(session),
    canManageUsersAccess ? isInitialAdminOnboardingPhase() : Promise.resolve(false),
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
    >
      {children}
    </AppShell>
  )
}
