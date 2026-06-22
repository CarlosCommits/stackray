"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { LogIn } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

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

type LoginFormProps = React.ComponentProps<"div"> & {
  demoMode?: boolean
  onExpandedChange?: (isExpanded: boolean) => void
}

export function LoginForm({
  className,
  demoMode = false,
  onExpandedChange,
  ...props
}: LoginFormProps) {
  const { push, refresh } = useRouter()
  const emailInputRef = useRef<HTMLInputElement>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isExpanded) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      emailInputRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isExpanded])

  const expandForm = () => {
    setIsExpanded(true)
    onExpandedChange?.(true)
  }

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

    push("/dashboard")
    refresh()
  }

  return (
    <div className={cn("flex w-full justify-center", className)} {...props}>
      <motion.div
        layout
        className={cn(
          "overflow-hidden rounded-lg",
          isExpanded
            ? "w-full border border-[var(--gray-border)] bg-[color-mix(in_srgb,var(--surface-dark)_88%,transparent)] shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            : "w-56 border-0 bg-transparent shadow-none"
        )}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {!isExpanded ? (
            <motion.div
              key="login-button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="p-0"
            >
              <Button
                type={demoMode ? undefined : "button"}
                aria-expanded={demoMode ? undefined : isExpanded}
                onClick={demoMode ? undefined : expandForm}
                asChild={demoMode}
                className="h-12 w-full gap-2 bg-[var(--accent)] font-semibold text-[var(--primary-foreground)] shadow-[0_0_32px_rgba(251,191,36,0.18)] hover:bg-[color-mix(in_srgb,var(--accent)_86%,white)]"
              >
                {demoMode ? (
                  <Link href="/dashboard">
                    <LogIn className="size-4" />
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Sign in
                  </>
                )}
              </Button>
            </motion.div>
          ) : (
            <motion.form
              key="login-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.08 }}
              className="p-5 sm:p-6"
              onSubmit={handleSubmit}
            >
              <FieldGroup className="gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
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
                    ref={emailInputRef}
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
                    <FieldLabel
                      htmlFor="password"
                      className="text-[var(--foreground)]"
                    >
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
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
