import { redirect } from "next/navigation"

import { UsersPageClient } from "@/components/settings/users/users-page-client"
import { canSendAuthEmail } from "@/lib/auth/mailer"
import { requireAppSession } from "@/lib/auth/session"
import { isAdmin } from "@/lib/server/authz"
import { listUsers } from "@/lib/server/users/service"

export default async function SettingsUsersPage() {
  const session = await requireAppSession()

  if (!isAdmin(session)) {
    redirect("/dashboard")
  }

  const response = await listUsers(session)

  return (
    <UsersPageClient
      initialUsers={response.items}
      canEmailUsers={canSendAuthEmail()}
      currentRole={session.user.role}
    />
  )
}
