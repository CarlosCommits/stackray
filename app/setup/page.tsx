import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FirstRunBootstrapForm } from "@/components/setup/first-run-bootstrap-form"
import { env } from "@/lib/env/server"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { isDemoModeEnabled } from "@/lib/demo-mode"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Set up Stackray | Stackray",
  description: "Bootstrap the first Stackray administrator and complete initial setup.",
}

export default async function SetupPage() {
  if (isDemoModeEnabled()) {
    redirect("/dashboard")
  }

  const bootstrapNeeded = await isBootstrapOpen()

  if (bootstrapNeeded) {
    return <FirstRunBootstrapForm />
  }

  const canPreviewSetupFlow = env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true"

  if (canPreviewSetupFlow) {
    return <FirstRunBootstrapForm developmentPreview />
  }

  const session = await getAppSession()

  if (!session) {
    redirect("/")
  }

  if (session.requiresPasswordChange) {
    redirect("/change-password")
  }

  redirect("/dashboard")
}
