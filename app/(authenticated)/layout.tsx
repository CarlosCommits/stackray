import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { TimeZoneProvider } from "@/components/ui/time-zone-provider"
import { getAppSession } from "@/lib/session/app-session"
import { canAccessApiKeys, canManageUsers } from "@/lib/authorization/authz"
import { env } from "@/lib/env/server"
import { isBootstrapOpen, isInitialAdminOnboardingPhase } from "@/lib/server/bootstrap/service"
import { getUserProductState } from "@/lib/server/product-state/service"
import { getStackrayReleaseByVersion, getStackrayUpdateStatus } from "@/lib/server/app-updates/service"
import { APP_VERSION } from "@/lib/version"
import { BROWSER_TIME_ZONE_COOKIE_NAME, isValidTimeZone } from "@/lib/time"
import { isDemoModeEnabled } from "@/lib/demo-mode"

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

  const demoMode = isDemoModeEnabled()
  const canManageUsersAccess = demoMode ? false : canManageUsers(session)
  const canPreviewSetupCompleteOnboarding = env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true"
  const [productState, showGettingStarted, stackrayUpdateStatus, currentStackrayRelease] = await Promise.all([
    getUserProductState(session),
    canManageUsersAccess ? isInitialAdminOnboardingPhase() : Promise.resolve(false),
    canManageUsersAccess ? getStackrayUpdateStatus() : Promise.resolve(null),
    getStackrayReleaseByVersion(APP_VERSION),
  ])
  const cookieTimeZone = (await cookies()).get(BROWSER_TIME_ZONE_COOKIE_NAME)?.value ?? null
  const initialTimeZone = cookieTimeZone && isValidTimeZone(cookieTimeZone) ? cookieTimeZone : null

  return (
    <TimeZoneProvider initialTimeZone={initialTimeZone}>
      <AppShell
        user={{
          email: session.user.email,
          displayName: session.user.displayName,
          image: session.user.image,
          role: session.user.role,
        }}
        canManageUsers={canManageUsersAccess}
        canAccessApiKeys={demoMode ? false : canAccessApiKeys(session)}
        lastSeenReleaseVersion={productState.lastSeenReleaseVersion}
        gettingStartedDismissedAt={productState.gettingStartedDismissedAt}
        showGettingStarted={showGettingStarted}
        enableSetupCompleteGettingStarted={canPreviewSetupCompleteOnboarding}
        stackrayUpdateStatus={stackrayUpdateStatus}
        currentStackrayRelease={currentStackrayRelease}
        demoMode={demoMode}
      >
        {children}
      </AppShell>
    </TimeZoneProvider>
  )
}
