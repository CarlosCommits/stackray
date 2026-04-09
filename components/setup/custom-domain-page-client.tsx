"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import type { CustomDomainState } from "@/lib/contracts/setup"
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Globe,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react"

export function CustomDomainPageClient({
  initialState,
}: {
  initialState: CustomDomainState | null
}) {
  const [state, setState] = useState<CustomDomainState | null>(initialState)
  const [hostnameInput, setHostnameInput] = useState(initialState?.hostname ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialState) return

    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/v1/setup/custom-domain")
        if (!response.ok) return
        const data: CustomDomainState = await response.json()
        if (cancelled) return
        setState(data)
        setHostnameInput(data.hostname ?? "")
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Unable to load custom domain state.")
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [initialState])

  const handleSave = useCallback(async () => {
    setError(null)
    setIsSaving(true)

    try {
      const response = await fetch("/api/v1/setup/custom-domain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: hostnameInput.trim() }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to save the hostname.")
        return
      }

      setState(payload as CustomDomainState)
    } catch {
      setError("A network error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }, [hostnameInput])

  const handleVerify = useCallback(async () => {
    setError(null)
    setIsVerifying(true)

    try {
      const response = await fetch("/api/v1/setup/custom-domain/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: hostnameInput.trim() || undefined }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error?.message ?? "Verification failed.")
        return
      }

      setState(payload as CustomDomainState)
    } catch {
      setError("A network error occurred. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }, [hostnameInput])

  const savedHostname = state?.hostname
  const hasSavedHostname = Boolean(savedHostname)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Custom domain</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Point your own domain at this Stackray instance.
          </p>
        </div>
        <Link
          href="/setup"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="size-4" />
          Back to setup
        </Link>
      </div>

      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
              <Globe className="size-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
                Domain hostname
              </CardTitle>
              <CardDescription className="text-sm text-[var(--text-dim)]">
                Enter the domain you want to use (e.g. <code className="rounded bg-[var(--surface-mid)] px-1 py-0.5 text-xs font-mono">stackray.example.com</code>).
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              handleSave()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="custom-domain-hostname" className="text-[var(--foreground)]">
                Hostname
              </Label>
              <Input
                id="custom-domain-hostname"
                type="text"
                value={hostnameInput}
                onChange={(event) => setHostnameInput(event.target.value)}
                className="border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]"
                placeholder="stackray.example.com"
                required
                disabled={isSaving || isVerifying}
              />
              <p className="text-xs text-[var(--text-dim)]">
                This hostname will be used for DNS verification and app reachability checks.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSaving || isVerifying || !hostnameInput.trim()}
                className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save hostname"
                )}
              </Button>
              {hasSavedHostname && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isVerifying || isSaving}
                  onClick={handleVerify}
                  className="border-[var(--gray-border)] text-[var(--foreground)] hover:bg-[var(--surface-light)]"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" />
                      Verify
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {state && hasSavedHostname && (
        <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
                <Server className="size-5 text-[var(--accent)]" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
                  Verification status
                </CardTitle>
                <CardDescription className="text-sm text-[var(--text-dim)]">
                  Results for <code className="rounded bg-[var(--surface-mid)] px-1 py-0.5 text-xs font-mono">{savedHostname}</code>
                  {state.lastCheckedAt && (
                    <> &mdash; last checked {new Date(state.lastCheckedAt).toLocaleString()}</>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3">
                {state.dnsVerified ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">DNS resolution</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {state.dnsVerified
                      ? "Hostname resolves to the expected target."
                      : "Hostname does not resolve yet. Check your DNS configuration."}
                  </p>
                  {state.cnameTargets.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {state.cnameTargets.map((target) => (
                        <code key={target} className="block text-xs font-mono text-[var(--text-dim)]">
                          CNAME → {target}
                        </code>
                      ))}
                    </div>
                  )}
                  {state.resolvedAddresses.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {state.resolvedAddresses.map((addr) => (
                        <code key={addr} className="block text-xs font-mono text-[var(--text-dim)]">
                          A → {addr}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3">
                {state.appVerified ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">App reachability</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {state.appVerified
                      ? "The app responds on this domain over HTTPS."
                      : "The app is not reachable on this domain. DNS may still be propagating, or the domain is not configured in your hosting platform."}
                  </p>
                </div>
              </div>
            </div>

            {state.dnsVerified && state.appVerified && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <p className="text-sm text-emerald-300">
                  Custom domain is verified and working.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
              <CircleAlert className="size-5 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
                Setup guide
              </CardTitle>
              <CardDescription className="text-sm text-[var(--text-dim)]">
                How to wire up a custom domain on Railway.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm text-[var(--text-dim)]">
            <div className="space-y-1.5">
              <p className="font-medium text-[var(--foreground)]">1. Add the domain in Railway</p>
              <p>
                In your Railway service settings, under &ldquo;Domains&rdquo;, add a custom domain.
                Railway will show you the CNAME target to point your DNS at.
              </p>
              {state?.expectedRailwayDomain && (
                <p className="rounded bg-[var(--surface-mid)] px-3 py-2 font-mono text-xs text-[var(--foreground)]">
                  Your Railway domain: {state.expectedRailwayDomain}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-[var(--foreground)]">2. Configure DNS</p>
              <p>
                Create a CNAME record pointing your hostname to the Railway-provided target.
                DNS propagation can take up to 48 hours, though it&rsquo;s often faster.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-[var(--foreground)]">3. Allow the hostname in auth</p>
              <p>
                Add your custom hostname to the{" "}
                <code className="rounded bg-[var(--surface-mid)] px-1 py-0.5 text-xs font-mono">
                  STACKRAY_ALLOWED_HOSTS
                </code>{" "}
                environment variable (comma-separated). This ensures Better Auth accepts
                cookies and sessions on your custom domain.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-[var(--foreground)]">4. Update the public URL</p>
              <p>
                Once the domain is verified, go back to{" "}
                <Link href="/setup" className="text-[var(--accent)] hover:underline">
                  Setup
                </Link>{" "}
                and update your public URL to{" "}
                <code className="rounded bg-[var(--surface-mid)] px-1 py-0.5 text-xs font-mono">
                  https://{savedHostname ?? "your-domain"}
                </code>{" "}
                so that generated links and callbacks use the custom domain.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3">
            <p className="text-xs text-[var(--text-dim)]">
              <strong className="text-[var(--foreground)]">Note:</strong> This page provides guidance
              and verification only. Domain provisioning and DNS changes must be done in Railway
              and your DNS provider. The{" "}
              <code className="rounded bg-[var(--surface-dark)] px-1 py-0.5 text-xs font-mono">
                STACKRAY_ALLOWED_HOSTS
              </code>{" "}
              env var requires a redeploy to take effect.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p aria-live="polite" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
