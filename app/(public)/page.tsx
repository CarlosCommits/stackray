import { redirect } from "next/navigation"
import { Github } from "lucide-react"

import { FallingPattern } from "@/components/falling-pattern"
import { LoginStage } from "@/components/login-stage"
import { Button } from "@/components/ui/button"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"
import { env } from "@/lib/env/server"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const showPublicHomeInLocalDev = env.NODE_ENV !== "production" && env.STACKRAY_ENABLE_DEV_ACTOR === "true"
  const session = showPublicHomeInLocalDev ? null : await getAppSession()

  if (session) {
    redirect(session.requiresPasswordChange ? "/change-password" : "/dashboard")
  }

  if (await isBootstrapOpen()) {
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
            <Github className="size-4" />
            GitHub
          </a>
        </Button>
      </div>

      <LoginStage />
    </main>
  )
}
