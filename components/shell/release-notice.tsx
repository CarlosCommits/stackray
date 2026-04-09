"use client"

import { useState } from "react"
import { XIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
      <div className="flex items-center justify-between gap-3 border-b border-[var(--gray-border)] bg-[var(--accent)]/10 px-4 py-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
        >
          <SparklesIcon className="size-3.5" />
          <span>What&apos;s new in v{currentVersion}</span>
          <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-[10px]">
            New
          </Badge>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleDismiss}
          className="text-[var(--text-dim)] hover:text-[var(--foreground)]"
        >
          <XIcon />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-[var(--accent)]" />
              v{currentVersion}
            </DialogTitle>
            <DialogDescription>
              What&apos;s new in this release
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {releaseContent ?? (
              <p>Stackray has been updated to v{currentVersion}.</p>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => {
                setDialogOpen(false)
                handleDismiss()
              }}
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}