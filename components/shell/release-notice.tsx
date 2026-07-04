"use client"

import { useState } from "react"
import { CloudCheck, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal"

interface ReleaseNoticeProps {
  currentVersion: string
  lastSeenVersion: string | null
  releaseContent?: React.ReactNode
  onDismiss: (version: string) => void
}

export function ReleaseNotice({
  currentVersion,
  lastSeenVersion,
  releaseContent,
  onDismiss,
}: ReleaseNoticeProps) {
  const [dismissed, setDismissed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const isNewRelease = lastSeenVersion !== currentVersion

  if (!isNewRelease || dismissed) {
    return null
  }

  function handleDismiss() {
    setDismissed(true)
    onDismiss(currentVersion)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 sm:px-4 sm:pl-16 sm:text-sm md:px-6">
        <div className="flex min-w-0 items-center gap-2 font-medium">
          <CloudCheck className="size-3.5 shrink-0 text-emerald-200 sm:size-4" aria-hidden="true" />
          <span className="min-w-0 truncate">What&apos;s new in v{currentVersion}</span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="cursor-pointer rounded-md px-1.5 py-1 text-xs font-medium text-emerald-100/90 transition hover:bg-emerald-400/15 hover:text-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 sm:px-2"
          >
            View notes
          </button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDismiss}
            className="cursor-pointer text-emerald-100/75 hover:bg-emerald-400/15 hover:text-emerald-50 focus-visible:ring-emerald-300/70"
          >
            <XIcon className="size-3.5 sm:size-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>

      <ResponsiveModal open={dialogOpen} onOpenChange={setDialogOpen} drawerProps={{ repositionInputs: false }}>
        <ResponsiveModalContent
          desktopClassName="grid max-h-[calc(100svh-1rem)] w-[calc(100vw-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:!max-w-lg sm:max-h-[85vh]"
          mobileClassName="h-[92svh] overflow-hidden p-0"
        >
          <ResponsiveModalHeader className="px-4 pb-3 pt-4 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left sm:px-5 sm:pt-5">
            <ResponsiveModalTitle className="flex items-center gap-2">
              <CloudCheck className="size-4 text-emerald-300" aria-hidden="true" />
              Stackray updated
            </ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Stackray has been updated to v{currentVersion}. Review what changed in this release.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto px-4 py-2 text-sm sm:px-5">
            <div className="rounded-md border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 font-mono text-xs">
              <p className="mb-1 text-[var(--text-dim)]">Current version</p>
              <p className="text-[var(--foreground)]">v{currentVersion}</p>
            </div>
            {releaseContent ?? (
              <p className="text-[var(--text-dim)]">Stackray has been updated to v{currentVersion}.</p>
            )}
          </div>
          <ResponsiveModalFooter className="mx-0 mb-0 flex-col-reverse rounded-b-xl border-t border-[var(--gray-border)]/50 bg-[var(--surface-mid)]/45 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:flex-row sm:px-5">
            <Button
              size="sm"
              onClick={() => {
                setDialogOpen(false)
                handleDismiss()
              }}
            >
              Got it
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  )
}
