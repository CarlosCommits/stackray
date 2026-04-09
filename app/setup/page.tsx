import { redirect } from "next/navigation"

import { FirstRunBootstrapForm } from "@/components/setup/first-run-bootstrap-form"
import { SetupPageClient } from "@/components/setup/setup-page-client"
import { isAdmin } from "@/lib/authorization/authz"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { getSetupState } from "@/lib/server/setup/service"

export default async function SetupPage() {
  const bootstrapNeeded = await isBootstrapOpen()

  if (bootstrapNeeded) {
    return <FirstRunBootstrapForm />
  }

  const session = await getAppSession()

  if (!session) {
    redirect("/sign-in")
  }

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
      hasScans={setupState.hasScans}
      isSetupComplete={setupState.isSetupComplete}
    />
  )
}
