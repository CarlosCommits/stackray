import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { buildSignInHref, getSafeReturnTo } from "@/lib/auth/return-to"
import { getAppSession } from "@/lib/session/app-session"

export const metadata: Metadata = {
  title: "Change password | Stackray",
  description: "Update your Stackray account password.",
}

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const [session, resolvedSearchParams] = await Promise.all([
    getAppSession(),
    searchParams,
  ])
  const requestedReturnTo = resolvedSearchParams.returnTo
  const returnTo = getSafeReturnTo(
    Array.isArray(requestedReturnTo) ? requestedReturnTo[0] : requestedReturnTo,
  )

  if (!session) {
    redirect(buildSignInHref(returnTo))
  }

  if (!session.requiresPasswordChange) {
    redirect(returnTo)
  }

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <ChangePasswordForm returnTo={returnTo} />
    </div>
  )
}
