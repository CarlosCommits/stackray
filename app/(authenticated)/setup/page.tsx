import { redirect } from "next/navigation"

import { SetupPageClient } from "@/components/setup/setup-page-client"
import { isAdmin } from "@/lib/authorization/authz"
import { requireAppSession } from "@/lib/session/app-session"
import { getSetupState } from "@/lib/server/setup/service"

export default async function SetupPage() {
  const session = await requireAppSession()

  if (!isAdmin(session)) {
    redirect("/dashboard")
  }

  const setupState = await getSetupState(session)

  return (
    <SetupPageClient
      publicUrl={setupState.publicUrl}
      detectedPublicUrl={setupState.detectedPublicUrl}
      hasUsers={setupState.hasUsers}
      hasTokens={setupState.hasTokens}
      isSetupComplete={setupState.isSetupComplete}
    />
  )
}
