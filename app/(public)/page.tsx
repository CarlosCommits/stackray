import Image from "next/image"
import { redirect } from "next/navigation"
import { Github } from "lucide-react"

import { FallingPattern } from "@/components/falling-pattern"
import { LoginForm } from "@/components/login-form"
import { Button } from "@/components/ui/button"
import { getAppSession } from "@/lib/session/app-session"
import { isBootstrapOpen } from "@/lib/server/bootstrap/service"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await getAppSession()

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

      <section className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-6 py-12">
        <div className="relative mb-7 flex flex-col items-center gap-5 text-center">
          <div
            aria-hidden="true"
            className="absolute -inset-x-24 -inset-y-12 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.88)_32%,rgba(0,0,0,0.42)_62%,transparent_82%)]"
          />
          <div className="flex items-center gap-1">
            <div className="flex size-24 items-center justify-center drop-shadow-[0_16px_45px_rgba(0,0,0,0.45)]">
              <Image
                src="/stackray-logo.svg"
                alt=""
                width={96}
                height={96}
                priority
                className="size-24"
              />
            </div>
            <span className="font-[var(--font-heading)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
              StackRay
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--accent)]/85">
              Self-hosted / Open source
            </p>
            <h1 className="max-w-3xl text-balance font-[var(--font-heading)] text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">
              Inspect the stack behind any site.
            </h1>
            <p className="mx-auto max-w-xl text-base leading-7 text-[var(--text-dim)] sm:text-lg">
              Self-hosted technology intelligence for your team.
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <div className="absolute -inset-px rounded-[10px] bg-[linear-gradient(180deg,rgba(251,191,36,0.38),rgba(52,64,79,0.12)_42%,rgba(251,191,36,0.16))] blur-[1px]" />
          <LoginForm className="relative" />
        </div>
      </section>
    </main>
  )
}
