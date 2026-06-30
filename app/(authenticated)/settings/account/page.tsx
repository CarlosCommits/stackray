import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AccountPageClient } from "@/components/settings/account/account-page-client"
import { isDemoModeEnabled } from "@/lib/demo-mode"
import { requireAppSession } from "@/lib/session/app-session"

export const metadata: Metadata = {
  title: "Account | Stackray",
  description: "Manage your Stackray account security.",
}

export default async function AccountPage() {
  if (isDemoModeEnabled()) {
    notFound()
  }

  const session = await requireAppSession()

  return (
    <AccountPageClient
      user={{
        displayName: session.user.displayName,
        email: session.user.email,
      }}
    />
  )
}
