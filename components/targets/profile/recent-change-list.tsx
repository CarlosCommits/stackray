"use client"

import dynamic from "next/dynamic"
import { useRef, useState } from "react"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"

import {
  ChangeTypeIcon,
  getChangeTitle,
} from "@/components/changes/change-presentation"
import type {
  ChangeFeedItem,
  ScanComparison,
} from "@/lib/contracts/changes"
import { cn } from "@/lib/utils"
import { trackStackrayEvent } from "@/lib/analytics"

const ChangeDetailModal = dynamic(
  () => import("@/components/changes/change-detail-modal").then((module) => module.ChangeDetailModal),
  {
    loading: () => <p role="status" className="sr-only">Opening change details</p>,
  },
)

export function RecentChangeList({
  comparisonId,
  items,
}: {
  comparisonId: string
  items: ChangeFeedItem[]
}) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedComparison, setSelectedComparison] = useState<ScanComparison | null>(null)
  const detailRequestId = useRef(0)

  const openChange = async (itemId: string) => {
    trackStackrayEvent("change_detail_opened", { source: "target_overview" })
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setSelectedItemId(itemId)
    setSelectedComparison(null)

    try {
      const request = await fetch(`/api/v1/changes/${encodeURIComponent(comparisonId)}`, {
        headers: { Accept: "application/json" },
      })

      if (!request.ok) {
        throw new Error("Unable to load the change details.")
      }

      const comparison = await request.json() as ScanComparison
      if (detailRequestId.current === requestId) {
        setSelectedComparison(comparison)
      }
    } catch (error) {
      if (detailRequestId.current === requestId) {
        setSelectedItemId(null)
        toast.error(error instanceof Error ? error.message : "Unable to load the change details.")
      }
    }
  }

  const closeChange = () => {
    detailRequestId.current += 1
    setSelectedItemId(null)
    setSelectedComparison(null)
  }

  return (
    <>
      <div className="mt-2 divide-y divide-border/30">
        {items.map((item) => {
          const title = getChangeTitle(item)
          const pending = selectedItemId === item.id && !selectedComparison

          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Open ${title} details`}
              aria-busy={pending}
              aria-haspopup="dialog"
              onClick={() => openChange(item.id)}
              className={cn(
                "group flex w-full cursor-pointer items-start gap-3 py-3 text-left text-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                pending && "opacity-70",
              )}
            >
              <ChangeTypeIcon changeType={item.changeType} className="mt-0.5 size-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-foreground">{title}</span>
                {item.preview ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.preview}</span>
                ) : null}
              </span>
              <ArrowRight
                className={cn(
                  "mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100",
                  pending && "animate-pulse opacity-100 motion-reduce:animate-none",
                )}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      {selectedItemId && selectedComparison ? (
        <ChangeDetailModal
          comparison={selectedComparison}
          initialItemId={selectedItemId}
          onClose={closeChange}
        />
      ) : null}
    </>
  )
}
