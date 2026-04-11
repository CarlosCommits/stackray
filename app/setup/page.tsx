import { redirect } from "next/navigation"

import { FirstRunBootstrapForm } from "@/components/setup/first-run-bootstrap-form"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const bootstrapNeeded = await isBootstrapOpen()

  if (bootstrapNeeded) {
    return <FirstRunBootstrapForm />
  }

  const session = await getAppSession()

  if (!session) {
    redirect("/sign-in")
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  redirect("/dashboard")
}
