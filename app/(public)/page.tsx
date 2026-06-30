import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { FallingPattern } from "@/components/falling-pattern"
import { LoginStage } from "@/components/login-stage"
import { Button } from "@/components/ui/button"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { env } from "@/lib/env/server"
import { isDemoModeEnabled } from "@/lib/demo-mode"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Stackray | Site Intelligence",
  description: "Run site intelligence scans, discover technology stacks, and review target history from one dashboard.",
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  )
}

export default async function HomePage() {
  const showPublicHomeInLocalDev = env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true"
  const demoMode = isDemoModeEnabled()
  const session = showPublicHomeInLocalDev || demoMode ? null : await getAppSession()

  if (session) {
    redirect(session.requiresPasswordChange ? "/change-password" : "/dashboard")
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
            >
              <GitHubIcon className="size-4" />
              GitHub
            </a>
          </Button>
        </div>
      </div>

      <LoginStage demoMode={demoMode} />
    </main>
  )
}
