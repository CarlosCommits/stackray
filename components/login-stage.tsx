"use client"

import Image from "next/image"
import { useState } from "react"
import { motion } from "motion/react"

import { LoginForm } from "@/components/login-form"

const layoutTransition = {
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1],
} as const

export function LoginStage({ demoMode = false }: { demoMode?: boolean }) {
  const [isLoginExpanded, setIsLoginExpanded] = useState(false)

  return (
    <motion.section
      layout
      transition={layoutTransition}
      className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-6 py-12"
    >
      <motion.div
        layout
        animate={{ y: isLoginExpanded ? -18 : 0 }}
        transition={layoutTransition}
        className="relative mb-7 flex flex-col items-center gap-5 text-center"
      >
        <div
          aria-hidden="true"
          className="absolute -inset-x-24 -inset-y-12 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.98)_0%,rgba(0,0,0,0.88)_32%,rgba(0,0,0,0.42)_62%,transparent_82%)]"
        />
        <div className="flex items-center gap-1">
          <div className="flex size-20 items-center justify-center drop-shadow-[0_16px_45px_rgba(0,0,0,0.45)]">
            <Image
              src="/stackray-logo-rendered.webp"
              alt=""
              width={80}
              height={80}
              priority
              className="size-20"
            />
          </div>
          <span className="text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-5xl">
            StackRay
          </span>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--accent)]/85">
            Self-hosted / Open source
          </p>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-[var(--foreground)] sm:text-6xl">
            Inspect the stack behind any site.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-7 text-[var(--text-dim)] sm:text-lg">
            Self-hosted technology intelligence for your team.
          </p>
        </div>
      </motion.div>

      <motion.div
        layout
        transition={layoutTransition}
        className="relative flex w-full max-w-md justify-center"
      >
        <LoginForm className="relative" demoMode={demoMode} onExpandedChange={setIsLoginExpanded} />
      </motion.div>
    </motion.section>
  )
}
