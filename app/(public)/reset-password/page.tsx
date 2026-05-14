import type { Metadata } from "next"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = {
  title: "Reset password | Stackray",
  description: "Reset your Stackray account password with a secure reset token.",
}

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  const token = typeof params.token === "string" ? params.token : null

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <ResetPasswordForm token={token} />
    </div>
  )
}
