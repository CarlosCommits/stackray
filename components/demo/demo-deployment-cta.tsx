"use client"

import Image from "next/image"
import type { ComponentType } from "react"

import { BorderRotate } from "@/components/ui/animated-gradient-border"
import { Button } from "@/components/ui/button"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import { trackStackrayEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export const STACKRAY_RAILWAY_TEMPLATE_URL = "https://railway.com/deploy/stackray"

interface DemoRailwayButtonProps {
  source: string
  className?: string
}

function DemoRailwayButton({ source, className }: DemoRailwayButtonProps) {
  return (
    <BorderRotate
      animationMode="auto-rotate"
      animationSpeed={3.6}
      backgroundColor="color-mix(in srgb, #6d28d9 34%, var(--surface-dark))"
      borderRadius={8}
      borderWidth={1}
      className={cn("h-10 shadow-[0_8px_22px_rgb(109_40_217_/_0.34)] sm:h-8", className)}
      gradientColors={{ primary: "#2e174d", secondary: "#8b5cf6", accent: "#d8b4fe" }}
    >
      <a
        href={STACKRAY_RAILWAY_TEMPLATE_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-full w-full cursor-pointer items-center justify-center gap-1.5 rounded-[6px] bg-[linear-gradient(135deg,rgb(91_33_182_/_0.68),rgb(46_23_77_/_0.9))] px-4 font-heading text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.14)] [&:hover]:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200/75 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-dark)]"
        onClick={() => trackStackrayEvent("railway_template_click", { source })}
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
    </BorderRotate>
  )
}

interface DemoDeploymentCtaProps {
  source: string
  title?: string
  description: string
  className?: string
}

export function DemoDeploymentCta({
  source,
  title = "Available in your own deployment",
  description,
  className,
}: DemoDeploymentCtaProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/30 p-3",
      className,
    )}>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
        <p className="text-xs leading-relaxed text-[var(--text-dim)]">{description}</p>
      </div>
      <DemoRailwayButton source={source} className="w-full sm:w-fit" />
    </div>
  )
}

interface DemoDeploymentFeature {
  icon: ComponentType<{ className?: string }>
  label: string
}

interface DemoDeploymentPromptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: string
  title: string
  description: string
  features: DemoDeploymentFeature[]
}

export function DemoDeploymentPrompt({
  open,
  onOpenChange,
  source,
  title,
  description,
  features,
}: DemoDeploymentPromptProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        className="overflow-hidden border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-dark)] p-0 gap-0 ring-[color-mix(in_srgb,var(--gray-border)_60%,#60a5fa)]"
        desktopClassName="sm:max-w-lg"
        mobileClassName="pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className="scanline-grid pointer-events-none absolute inset-x-0 -top-10 bottom-0 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--surface-mid)_70%,transparent)_0%,transparent_44%)]" />
        <div className="pointer-events-none absolute inset-x-0 -top-16 bottom-0 bg-[radial-gradient(78%_120%_at_88%_0%,color-mix(in_srgb,#8b5cf6_18%,transparent)_0%,transparent_58%)]" />

        <div className="relative flex flex-col gap-5 px-5 pb-8 pt-9">
          <div className="pointer-events-none absolute -inset-x-5 -top-16 bottom-0 bg-[radial-gradient(70%_130%_at_88%_0%,color-mix(in_srgb,#8b5cf6_22%,transparent)_0%,transparent_58%)]" />
          <ResponsiveModalHeader className="relative gap-2 pr-7 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <ResponsiveModalTitle className="font-heading text-lg font-semibold text-[var(--foreground)]">
              {title}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-sm text-[var(--text-dim)]">
              {description}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <div className="relative flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-dim)]">
              Your own deployment includes
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {features.map(({ icon: Icon, label }) => (
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

        <ResponsiveModalFooter className="relative mx-0 mb-0 gap-2 rounded-b-xl border-t border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[var(--surface-mid)]/30 px-5 py-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <DemoRailwayButton source={source} />
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
