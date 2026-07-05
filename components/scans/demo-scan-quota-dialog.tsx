"use client"

import Image from "next/image"
import { CalendarClock, KeyRound, Users } from "lucide-react"

import { BorderRotate } from "@/components/ui/animated-gradient-border"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { trackStackrayEvent } from "@/lib/analytics"

export const STACKRAY_RAILWAY_TEMPLATE_URL = "https://railway.com/templates/stackray"

interface DemoScanQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const deploymentFeatures = [
  { icon: CalendarClock, label: "Scheduled scans" },
  { icon: KeyRound, label: "API key access" },
  { icon: Users, label: "User invites for your team" },
]

export function DemoScanQuotaDialog({ open, onOpenChange }: DemoScanQuotaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-dark)] p-0 gap-0 ring-[color-mix(in_srgb,var(--gray-border)_60%,#60a5fa)] sm:max-w-lg">
        <div className="scanline-grid pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface-mid)_70%,transparent)_0%,transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(78%_120%_at_88%_-20%,color-mix(in_srgb,var(--accent)_18%,transparent)_0%,transparent_58%)]" />

        <div className="relative flex flex-col gap-5 px-5 pb-8 pt-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_130%_at_88%_-15%,color-mix(in_srgb,var(--accent)_24%,transparent)_0%,transparent_58%)]" />
          <DialogHeader className="relative gap-2 pr-7">
            <DialogTitle className="font-heading text-lg font-semibold text-[var(--foreground)]">
              Scan limit reached
            </DialogTitle>
            <DialogDescription className="text-sm text-[var(--text-dim)]">
              You&apos;ve used the available demo scans for today. Try again tomorrow, or launch your own Stackray instance on Railway to keep scanning and unlock additional features.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-dim)]">
              Your own deployment includes
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {deploymentFeatures.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2 rounded-lg border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/30 p-3 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.04)]"
                >
                  <Icon className="size-4 text-[var(--accent)]" />
                  <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="relative mx-0 mb-0 gap-2 rounded-b-xl border-t border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/30 px-5 py-4 sm:flex-row sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost" className="text-[var(--text-dim)] hover:text-[var(--foreground)]">
              Close
            </Button>
          </DialogClose>
          <BorderRotate
            animationMode="auto-rotate"
            animationSpeed={4}
            backgroundColor="color-mix(in srgb, var(--accent) 26%, var(--surface-dark))"
            borderRadius={8}
            borderWidth={1}
            className="h-10 shadow-[0_6px_16px_rgb(251_191_36_/_0.22)] sm:h-8"
            gradientColors={{ primary: "#584827", secondary: "#c7a03c", accent: "#f9de90" }}
          >
            <Button
              asChild
              className="h-full w-full cursor-pointer rounded-[6px] border-0 bg-transparent px-4 font-heading text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-none hover:bg-transparent hover:text-white"
            >
              <a
                href={STACKRAY_RAILWAY_TEMPLATE_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackStackrayEvent("railway_template_click", { source: "demo_quota_dialog" })}
              >
                <span
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="flex size-5 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgb(0_0_0_/_0.08)]"
                >
                  <Image
                    src="/railway-logo.svg"
                    alt=""
                    width={14}
                    height={14}
                    aria-hidden="true"
                  />
                </span>
                Launch on Railway
              </a>
            </Button>
          </BorderRotate>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
