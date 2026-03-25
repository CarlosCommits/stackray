"use client"

import { useState } from "react"

import { requestPasswordReset } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm({ emailEnabled }: { emailEnabled: boolean }) {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!emailEnabled) {
      setError("Password reset email is not configured. Contact your administrator.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setIsSubmitting(false)

    if (response.error) {
      setError(response.error.message ?? "Unable to request a password reset.")
      return
    }

    setMessage("If that email exists, a reset link has been sent.")
  }

  return (
    <Card className="mx-auto max-w-md bg-[var(--surface-dark)] border-[var(--gray-border)]">
      <CardHeader>
        <CardTitle className="text-[var(--foreground)]">Forgot password</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">
          Request a reset link or contact your administrator if email delivery is disabled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[var(--foreground)]">Email</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
          </div>
          {message && <p className="text-sm text-[var(--accent)]">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
