"use client"

import Image from "next/image"
import { useState } from "react"
import { useRouter } from "next/navigation"

import { FallingPattern } from "@/components/falling-pattern"
import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react"

interface FirstRunBootstrapFormProps {
  developmentPreview?: boolean
}

const setupDetails = [
  "Creates the first administrator",
  "Uses this email for sign-in",
  "Opens the getting-started guide on the dashboard",
] as const

export function FirstRunBootstrapForm({ developmentPreview = false }: FirstRunBootstrapFormProps) {
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

    if (developmentPreview) {
      push("/dashboard?stackraySetupComplete=1")
      refresh()
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
    <>
      <main className="relative flex min-h-svh overflow-hidden bg-[var(--gray-charcoal)] px-4 py-8 text-[var(--foreground)] sm:px-6 lg:px-8">
        <FallingPattern
          aria-hidden="true"
          className="absolute inset-0"
          color="#fbbf24"
          backgroundColor="#000000"
          duration={80}
          blurIntensity="0.5rem"
          density={2}
        />

        <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 self-center lg:grid-cols-[1.2fr_1fr]">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div
              aria-hidden="true"
              className="absolute -inset-x-20 -inset-y-12 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.88)_34%,rgba(0,0,0,0.42)_66%,transparent_84%)]"
            />
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center">
                <Image
                  src="/stackray-logo-rendered.webp"
                  alt=""
                  width={48}
                  height={48}
                  priority
                  className="size-12"
                />
              </div>
              <p className="text-lg font-semibold uppercase tracking-[0.28em] text-[var(--foreground)]">Stackray</p>
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Create the first admin.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-dim)] sm:text-lg">
              This account will manage users, API keys, schedules, and scan settings for this Stackray instance.
            </p>

            <div className="mt-8 grid gap-3">
              {setupDetails.map((detail) => (
                <div key={detail} className="flex items-center gap-3 text-sm text-[var(--foreground)]">
                  <CheckCircle2 className="size-4 text-[var(--accent)]" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

          </div>

          <div className="relative w-full max-w-xl justify-self-end overflow-hidden rounded-2xl border border-white/12 bg-[color-mix(in_srgb,var(--surface-dark)_88%,transparent)] p-4 shadow-[0_30px_100px_rgba(0,0,0,0.52)] backdrop-blur-2xl sm:p-6">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/80 to-transparent" />
            <div className="absolute bottom-8 left-0 top-8 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/45 to-transparent" />
            <div className="absolute bottom-8 right-0 top-8 w-px bg-gradient-to-b from-transparent via-[var(--accent)]/45 to-transparent" />
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-light)] ring-1 ring-white/10">
                  <ShieldCheck className="size-5 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight">Admin account</h2>
                  <p className="mt-1 text-sm leading-5 text-[var(--text-dim)]">
                    Use a real mailbox and a password you can keep.
                  </p>
                </div>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-display-name" className="text-[var(--foreground)]">
                  Display name
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-dim)]" />
                  <Input
                    id="bootstrap-display-name"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] pl-9 text-[var(--foreground)] placeholder:text-[var(--text-dim)]"
                    placeholder="Ada Lovelace"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bootstrap-email" className="text-[var(--foreground)]">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-dim)]" />
                  <Input
                    id="bootstrap-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] pl-9 text-[var(--foreground)] placeholder:text-[var(--text-dim)]"
                    placeholder="admin@stackray.local"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bootstrap-password" className="text-[var(--foreground)]">
                    Password
                  </Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-dim)]" />
                    <Input
                      id="bootstrap-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] pl-9 text-[var(--foreground)]"
                      required
                      minLength={12}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-dim)]">
                    At least 12 characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bootstrap-confirm-password" className="text-[var(--foreground)]">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-dim)]" />
                    <Input
                      id="bootstrap-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-11 border-[var(--gray-border)] bg-[var(--surface-mid)] pl-9 text-[var(--foreground)]"
                      required
                      minLength={12}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
              {error && (
                <p aria-live="polite" className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className={cn(
                  "h-11 w-full bg-[var(--accent)] text-[var(--primary-foreground)] shadow-[0_16px_34px_rgba(251,191,36,0.18)]",
                  "hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--accent)_88%,white)] hover:shadow-[0_20px_42px_rgba(251,191,36,0.26)]",
                  "active:translate-y-px active:scale-[0.99] active:bg-[color-mix(in_srgb,var(--accent)_82%,black)] active:shadow-[0_8px_18px_rgba(251,191,36,0.16)]"
                )}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create admin account"
                )}
              </Button>
            </form>
          </div>
        </section>
      </main>
    </>
  )
}
