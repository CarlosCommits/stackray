import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FirstRunBootstrapForm } from "@/components/setup/first-run-bootstrap-form"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Set up Stackray | Stackray",
  description: "Bootstrap the first Stackray administrator and complete initial setup.",
}

export default async function SetupPage() {
  const bootstrapNeeded = await isBootstrapOpen()

  if (bootstrapNeeded) {
    return <FirstRunBootstrapForm />
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
