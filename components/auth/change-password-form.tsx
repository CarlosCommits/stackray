"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ChangePasswordForm() {
  const { push, refresh } = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.")
      return
    }

    setIsSubmitting(true)
    const response = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    })
    setIsSubmitting(false)

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error?.message ?? "Unable to change the password.")
      return
    }

    setMessage("Password updated. Redirecting to your dashboard…")
    setTimeout(() => {
      push("/dashboard")
      refresh()
    }, 800)
  }

  return (
    <Card className="mx-auto max-w-md bg-[var(--surface-dark)] border-[var(--gray-border)]">
      <CardHeader>
        <CardTitle className="text-[var(--foreground)]">Change password</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">
          An admin issued a temporary password. Choose a new permanent password to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="current-password" className="text-[var(--foreground)]">Current password</Label>
            <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-[var(--foreground)]">New password</Label>
            <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-[var(--foreground)]">Confirm password</Label>
            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]" required />
          </div>
          {message && <p className="text-sm text-[var(--accent)]">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
