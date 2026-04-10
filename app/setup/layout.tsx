import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { canAccessApiTokens, canManageUsers } from "@/lib/authorization/authz"
import { getAppSession } from "@/lib/session/app-session"
import { getUserProductState } from "@/lib/server/product-state/service"

export const dynamic = "force-dynamic"

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    return <>{children}</>
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  const canManageSetup = canManageUsers(session)
  const productState = await getUserProductState(session)

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
      lastSeenReleaseVersion={productState.lastSeenReleaseVersion}
    >
      {children}
    </AppShell>
  )
}
