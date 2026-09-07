"use client"

import { useRef } from "react"
import { useRouter } from "next/navigation"

import { ChangeInspector } from "@/components/changes/change-inspector"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"
import type { ScanComparison } from "@/lib/contracts/changes"

export function ChangeDetailModal({
  comparison,
  initialItemId,
  closeHref,
  onClose,
}: {
  comparison: ScanComparison
  initialItemId?: string | null
  closeHref?: string
  onClose?: () => void
}) {
  const router = useRouter()
  const headingRef = useRef<HTMLHeadingElement>(null)

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (open) return
        if (onClose) {
          onClose()
          return
        }
        if (closeHref) router.replace(closeHref, { scroll: false })
      }}
      drawerProps={{ repositionInputs: false }}
    >
      <ResponsiveModalContent
        desktopClassName="flex h-[min(46rem,calc(100svh-3rem))] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:!max-w-3xl"
        mobileClassName="flex h-[92svh] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          headingRef.current?.focus()
        }}
      >
        <ResponsiveModalHeader className="sr-only">
          <ResponsiveModalTitle>Change comparison details</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Review the evidence that changed between the baseline and current scan.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ChangeInspector
          key={`${comparison.id}:${initialItemId ?? "default"}`}
          comparison={comparison}
          initialItemId={initialItemId}
          headingRef={headingRef}
        />
      </ResponsiveModalContent>
    </ResponsiveModal>
  )
}
