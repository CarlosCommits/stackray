"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn } from "@/lib/auth/client"
import { cn } from "@/lib/utils"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
    <div className={cn("w-full", className)} {...props}>
      <form
        className="rounded-lg border border-[var(--gray-border)] bg-[color-mix(in_srgb,var(--surface-dark)_88%,transparent)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6"
        onSubmit={handleSubmit}
      >
        <FieldGroup className="gap-4">
          <div className="space-y-1">
            <h2 className="font-[var(--font-heading)] text-xl font-semibold tracking-tight text-[var(--foreground)]">
              Sign in
            </h2>
            <p className="text-sm leading-6 text-[var(--text-dim)]">
              Use your StackRay credentials to continue.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="email" className="text-[var(--foreground)]">
              Email
            </FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)] placeholder:text-[var(--text-dim)]/55 focus-visible:border-[var(--accent)] focus-visible:ring-[var(--accent)]/25"
              placeholder="you@example.com"
              required
            />
          </Field>

          <Field>
            <div className="flex items-center">
              <FieldLabel htmlFor="password" className="text-[var(--foreground)]">
                Password
              </FieldLabel>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)] focus-visible:border-[var(--accent)] focus-visible:ring-[var(--accent)]/25"
              required
            />
            <div className="-mt-1 text-right">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </Field>

          {error ? <FieldError>{error}</FieldError> : null}

          <Field className="gap-3">
            <Button
              type="submit"
              className="h-11 w-full bg-[var(--accent)] font-semibold text-[var(--primary-foreground)] shadow-[0_0_32px_rgba(251,191,36,0.18)] hover:bg-[color-mix(in_srgb,var(--accent)_86%,white)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
