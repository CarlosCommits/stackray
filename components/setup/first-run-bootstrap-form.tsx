"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Shield } from "lucide-react"

export function FirstRunBootstrapForm() {
  const { push, refresh } = useRouter()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/v1/setup/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to create admin account.")
        setIsSubmitting(false)
        return
      }

      const signInResponse = await signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
      })

      if (signInResponse.error) {
        setError(signInResponse.error.message ?? "Account created but sign-in failed. Please sign in manually.")
        setIsSubmitting(false)
        return
      }

      push("/dashboard")
      refresh()
    } catch {
      setError("A network error occurred. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--gray-charcoal)] px-6 py-24">
      <Card className="mx-auto max-w-md bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
              <Shield className="size-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-[var(--foreground)]">Create admin account</CardTitle>
              <CardDescription className="text-[var(--text-dim)]">
                Set up the first administrator for your Stackray instance.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="bootstrap-display-name" className="text-[var(--foreground)]">
                Display name
              </Label>
              <Input
                id="bootstrap-display-name"
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
                placeholder="Admin"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bootstrap-email" className="text-[var(--foreground)]">
                Email
              </Label>
              <Input
                id="bootstrap-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
                placeholder="admin@example.com"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bootstrap-password" className="text-[var(--foreground)]">
                Password
              </Label>
              <Input
                id="bootstrap-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
                required
                minLength={12}
                disabled={isSubmitting}
              />
              <p className="text-xs text-[var(--text-dim)]">
                Must be at least 12 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bootstrap-confirm-password" className="text-[var(--foreground)]">
                Confirm password
              </Label>
              <Input
                id="bootstrap-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
                required
                minLength={12}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p aria-live="polite" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                "Create admin account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}