import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { canSendAuthEmail } from "@/lib/auth/mailer"

export const metadata: Metadata = {
  title: "Forgot password | Stackray",
  description: "Request a Stackray password reset link.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <ForgotPasswordForm emailEnabled={canSendAuthEmail()} />
    </div>
  )
}
