"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, LoaderCircle, Play } from "lucide-react"
import { toast } from "sonner"

import { DemoScanQuotaDialog } from "@/components/scans/demo-scan-quota-dialog"
import { Button } from "@/components/ui/button"
import { GradientBorder } from "@/components/ui/gradient-border"
import {
  DemoScanQuotaExceededError,
  queueScanFromUi,
} from "@/lib/scans/queue-scan-client"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { cn } from "@/lib/utils"

export function TargetScanButton({ target }: { target: string }) {
  const { push } = useRouter()
  const [queueing, setQueueing] = useState(false)
  const [queuedScanId, setQueuedScanId] = useState<string | null>(null)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const queued = queuedScanId !== null
  const targetLabel = formatTargetForDisplay(target)

  async function handleClick() {
    if (queuedScanId) {
      push(`/scans/${queuedScanId}`)
      return
    }

    if (queueing) return

    setQueueing(true)

    try {
      const scan = await queueScanFromUi({ source: "target_profile", target })
      setQueuedScanId(scan.scanId)
    } catch (error) {
      if (error instanceof DemoScanQuotaExceededError) {
        setQuotaDialogOpen(true)
        return
      }

      toast.error(error instanceof Error ? error.message : "Unable to queue the scan.")
    } finally {
      setQueueing(false)
    }
  }

  return (
    <>
      <GradientBorder
        backgroundColor={queued
          ? "color-mix(in srgb, #22c55e 34%, var(--surface-dark))"
          : "color-mix(in srgb, var(--accent) 26%, var(--surface-dark))"}
        borderRadius={8}
        borderWidth={1}
        className={cn(
          "shrink-0 rounded-lg shadow-[0_6px_14px_rgb(251_191_36_/_0.18)]",
          queued && "shadow-[0_6px_14px_rgb(34_197_94_/_0.18)]",
        )}
        data-disabled={queueing ? "true" : undefined}
        gradientColors={queued
          ? {
              primary: "#12351f",
              secondary: "#22c55e",
              accent: "#bbf7d0",
            }
          : {
              primary: "#584827",
              secondary: "#c7a03c",
              accent: "#f9de90",
            }}
      >
        <Button
          type="button"
          variant="ghost"
          disabled={queueing}
          onClick={() => void handleClick()}
          title={queued ? `Open queued scan for ${targetLabel}` : `Queue scan for ${targetLabel}`}
          aria-label={queued ? `Open queued scan for ${targetLabel}` : undefined}
          className="h-8 rounded-[7px] border-0 bg-transparent px-3 text-white shadow-none hover:bg-transparent hover:text-white"
        >
          {queued ? (
            <Check data-icon="inline-start" aria-hidden="true" />
          ) : queueing ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden="true" />
          ) : (
            <Play data-icon="inline-start" aria-hidden="true" />
          )}
          <span aria-live="polite">{queued ? "Queued" : queueing ? "Queueing…" : "Run scan"}</span>
        </Button>
      </GradientBorder>
      <DemoScanQuotaDialog open={quotaDialogOpen} onOpenChange={setQuotaDialogOpen} />
    </>
  )
}
