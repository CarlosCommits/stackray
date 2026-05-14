import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { getAppSession } from "@/lib/session/app-session"

export const metadata: Metadata = {
  title: "Change password | Stackray",
  description: "Update your Stackray account password.",
}

export default async function ChangePasswordPage() {
  const session = await getAppSession()

  if (!session) {
    redirect("/")
  }

  if (!session.requiresPasswordChange) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <ChangePasswordForm />
    </div>
  )
}
