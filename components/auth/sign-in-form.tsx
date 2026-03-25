"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const response = await signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    })

    setIsSubmitting(false)

    if (response.error) {
      setError(response.error.message ?? "Unable to sign in.")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <Card className="mx-auto max-w-md bg-[var(--surface-dark)] border-[var(--gray-border)]">
      <CardHeader>
        <CardTitle className="text-[var(--foreground)]">Sign in</CardTitle>
        <CardDescription className="text-[var(--text-dim)]">
          Use your Stackray credentials to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[var(--foreground)]">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[var(--foreground)]">Password</Label>
              <Link href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
              required
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
