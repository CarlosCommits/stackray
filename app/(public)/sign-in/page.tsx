import { redirect } from "next/navigation"

import { SignInForm } from "@/components/auth/sign-in-form"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"

export const dynamic = "force-dynamic"

export default async function SignInPage() {
  const session = await getAppSession()

  if (session) {
    redirect(session.requiresPasswordChange ? "/change-password" : "/dashboard")
  }

  if (await isBootstrapOpen()) {
    redirect("/setup")
  }

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <SignInForm />
    </div>
  )
}
