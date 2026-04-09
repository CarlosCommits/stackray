import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { AppShell } from "@/components/shell"
import { getAppSession } from "@/lib/session/app-session"
import { canAccessApiTokens, canManageUsers } from "@/lib/authorization/authz"
import { getUserProductState } from "@/lib/server/product-state/service"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { isInstanceSetupComplete, shouldRedirectToSetup } from "@/lib/server/setup/service"

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

  const canManageSetup = canManageUsers(session)
  const productState = await getUserProductState(session)

  if (shouldRedirectToSetup({
    pathname: (await headers()).get("x-stackray-pathname"),
    canManageSetup,
    isSetupComplete: canManageSetup ? await isInstanceSetupComplete() : true,
  })) {
    redirect("/setup")
  }

  return (
    <AppShell
      user={{
        email: session.user.email,
        displayName: session.user.displayName,
        image: session.user.image,
        role: session.user.role,
      }}
      canManageUsers={canManageSetup}
      canAccessTokens={canAccessApiTokens(session)}
      completedTours={productState.completedTours}
      lastSeenReleaseVersion={productState.lastSeenReleaseVersion}
    >
      {children}
    </AppShell>
  )
}
