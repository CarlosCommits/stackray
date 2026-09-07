import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FallingPattern } from "@/components/falling-pattern"
import { GitHubIcon } from "@/components/shared/github-icon"
import { LoginStage } from "@/components/login-stage"
import { Button } from "@/components/ui/button"
import { getSafeReturnTo } from "@/lib/auth/return-to"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { env } from "@/lib/env/server"
import { isDemoModeEnabled } from "@/lib/demo-mode"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Stackray | Site Intelligence",
  description: "Run site intelligence scans, discover technology stacks, and review target history from one dashboard.",
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const showPublicHomeInLocalDev = env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true"
  const demoMode = isDemoModeEnabled()
  const [session, resolvedSearchParams] = await Promise.all([
    showPublicHomeInLocalDev || demoMode ? Promise.resolve(null) : getAppSession(),
    searchParams,
  ])
  const requestedReturnTo = resolvedSearchParams.returnTo
  const returnTo = getSafeReturnTo(
    Array.isArray(requestedReturnTo) ? requestedReturnTo[0] : requestedReturnTo,
  )

  if (session) {
    redirect(
      session.requiresPasswordChange
        ? `/change-password?${new URLSearchParams({ returnTo }).toString()}`
        : returnTo,
    )
  }

  if (!demoMode && await isBootstrapOpen()) {
    redirect("/setup")
  }

  return (
    <main className="relative flex min-h-svh overflow-hidden bg-[var(--gray-charcoal)] text-[var(--foreground)]">
      <FallingPattern
        aria-hidden="true"
        className="absolute inset-0"
        color="#fbbf24"
        backgroundColor="#000000"
        duration={80}
        blurIntensity="0.5rem"
        density={2}
      />

      <div className="absolute right-6 top-6 z-20">
        <div className="flex items-center gap-2">
          {showPublicHomeInLocalDev && !demoMode && (
            <Button
              asChild
              variant="outline"
              className="h-10 gap-2 border-[var(--gray-border)] bg-[color-mix(in_srgb,var(--surface-dark)_88%,transparent)] px-3 text-sm font-medium text-[var(--foreground)] shadow-[0_14px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl hover:bg-[var(--surface-mid)] hover:text-[var(--foreground)]"
            >
              <a href="/setup">Set up Stackray</a>
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            className="h-10 gap-2 border-[var(--gray-border)] bg-[color-mix(in_srgb,var(--surface-dark)_88%,transparent)] px-3 text-sm font-medium text-[var(--foreground)] shadow-[0_14px_40px_rgba(0,0,0,0.32)] backdrop-blur-xl hover:bg-[var(--surface-mid)] hover:text-[var(--foreground)]"
          >
            <a
              href="https://github.com/CarlosCommits/stackray"
              target="_blank"
              rel="noreferrer"
              data-umami-event="github_click"
              data-umami-event-source="home"
            >
              <GitHubIcon className="size-4" />
              GitHub
            </a>
          </Button>
        </div>
      </div>

      <LoginStage demoMode={demoMode} returnTo={returnTo} />
    </main>
  )
}
