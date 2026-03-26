import { redirect } from "next/navigation"

import { AppShell } from "@/components/shell"
import { getAppSession } from "@/lib/session/app-session"
import { canManageUsers } from "@/lib/authorization/authz"

export const dynamic = "force-dynamic"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAppSession()

  if (!session) {
    redirect("/sign-in")
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  return (
    <AppShell
      user={{
        email: session.user.email,
        displayName: session.user.displayName,
        image: session.user.image,
        role: session.user.role,
      }}
      canManageUsers={canManageUsers(session)}
    >
      {children}
    </AppShell>
  )
}
