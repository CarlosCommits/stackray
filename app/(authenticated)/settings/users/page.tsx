import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { UsersPageClient } from "@/components/settings/users/users-page-client"
import { canSendAuthEmail } from "@/lib/auth/mailer"
import { requireAppSession } from "@/lib/session/app-session"
import { isAdmin } from "@/lib/authorization/authz"
import { listUsers } from "@/lib/server/users/service"
import { isDemoModeEnabled } from "@/lib/demo-mode"
import { DEMO_MOCK_USERS, DEMO_MOCK_USER_ID } from "@/lib/demo-mode-data"

export const metadata: Metadata = {
  title: "Users | Stackray",
  description: "Manage Stackray users, roles, passwords, and API key access.",
}

export default async function UsersPage() {
  if (isDemoModeEnabled()) {
    return (
      <UsersPageClient
        initialUsers={DEMO_MOCK_USERS}
        canEmailUsers={false}
        currentUserId={DEMO_MOCK_USER_ID}
        demoMode
      />
    )
  }

  const session = await requireAppSession()

  if (!isAdmin(session)) {
    redirect("/dashboard")
  }

  const response = await listUsers(session)

  return (
    <UsersPageClient
      initialUsers={response.items}
      canEmailUsers={canSendAuthEmail()}
      currentUserId={session.user.id}
    />
  )
}
