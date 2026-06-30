"use client"

import { useState, type FormEvent } from "react"
import { Check, CircleUserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

interface AccountPageClientProps {
  user: {
    displayName: string
    email: string
  }
}

export function AccountPageClient({ user }: AccountPageClientProps) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const accountLabel = user.displayName.trim() || user.email

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error?.message ?? "Unable to change the password.")
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setMessage("Password updated.")
    } catch {
      setError("Unable to reach the server. Check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="border-b border-[var(--gray-border)]/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <CircleUserRound className="size-4" aria-hidden="true" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle className="text-[var(--foreground)]">Password</CardTitle>
              <CardDescription className="text-[var(--text-dim)]">
                Update the password for {accountLabel} and optionally sign out other active sessions.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-5">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <FieldDescription>Use at least 12 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-new-password">Confirm new password</FieldLabel>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </Field>
              <Field orientation="horizontal" className="rounded-lg border border-[var(--gray-border)]/70 p-3.5">
                <Switch
                  id="revoke-other-sessions"
                  checked={revokeOtherSessions}
                  onCheckedChange={setRevokeOtherSessions}
                  aria-label="Sign out other sessions"
                />
                <FieldContent>
                  <FieldLabel htmlFor="revoke-other-sessions">Sign out other sessions</FieldLabel>
                  <FieldDescription>
                    Keep this on to invalidate other browsers and devices after the password changes.
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>

            <div className="flex flex-col gap-3 border-t border-[var(--gray-border)]/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div aria-live="polite" className="flex flex-col gap-1 text-sm">
                {message && (
                  <p className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)]">
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                    {message}
                  </p>
                )}
                {error && <FieldError>{error}</FieldError>}
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
