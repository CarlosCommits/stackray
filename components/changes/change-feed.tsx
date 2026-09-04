"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { GitCompareArrows } from "lucide-react"

import {
  ChangeComparisonTimeline,
  type SelectedChange,
} from "@/components/changes/change-comparison-timeline"
import { ChangeFilters, type ChangeFeedFilters } from "@/components/changes/change-filters"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import type { ChangeFeedResponse, ScanComparison } from "@/lib/contracts/changes"
import { CHANGE_FEED_PAGE_SIZE } from "@/lib/changes/feed"

const ChangeDetailModal = dynamic(
  () => import("@/components/changes/change-detail-modal").then((module) => module.ChangeDetailModal),
  {
    loading: () => <p role="status" className="sr-only">Opening change details</p>,
  },
)

export { targetComparisonHref } from "@/components/changes/change-comparison-timeline"
function changeFeedApiHref(filters: ChangeFeedFilters, cursor: string) {
  const params = new URLSearchParams({
    cursor,
    limit: String(CHANGE_FEED_PAGE_SIZE),
  })
  if (filters.target) params.set("target", filters.target)
  if (filters.category) params.set("category", filters.category)
  return `/api/v1/changes?${params.toString()}`
}

export function ChangeFeed({ response, filters }: { response: ChangeFeedResponse; filters: ChangeFeedFilters }) {
  const [comparisons, setComparisons] = useState(response.items)
  const [nextCursor, setNextCursor] = useState(response.nextCursor)
  const [selectedChange, setSelectedChange] = useState<SelectedChange | null>(null)
  const [selectedComparison, setSelectedComparison] = useState<ScanComparison | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const detailRequestId = useRef(0)

  const openChange = async (selection: SelectedChange) => {
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setSelectedChange(selection)
    setSelectedComparison(null)
    setDetailError(null)
    setIsLoadingDetail(true)

    try {
      const request = await fetch(`/api/v1/changes/${encodeURIComponent(selection.comparisonId)}`, {
        headers: { Accept: "application/json" },
      })

      if (!request.ok) {
        throw new Error("Unable to load the comparison.")
      }

      const comparison = await request.json() as ScanComparison
      if (detailRequestId.current === requestId) {
        setSelectedComparison(comparison)
      }
    } catch {
      if (detailRequestId.current === requestId) {
        setSelectedChange(null)
        setDetailError("That change could not be loaded. Try again.")
      }
    } finally {
      if (detailRequestId.current === requestId) {
        setIsLoadingDetail(false)
      }
    }
  }

  const loadOlder = async () => {
    if (!nextCursor || isLoadingOlder) return

    setIsLoadingOlder(true)
    setLoadError(null)

    try {
      const request = await fetch(changeFeedApiHref(filters, nextCursor), {
        headers: { Accept: "application/json" },
      })

      if (!request.ok) {
        throw new Error("Unable to load older comparisons.")
      }

      const nextPage = await request.json() as ChangeFeedResponse
      setComparisons((current) => {
        const seen = new Set(current.map((comparison) => comparison.id))
        return [...current, ...nextPage.items.filter((comparison) => !seen.has(comparison.id))]
      })
      setNextCursor(nextPage.nextCursor)
    } catch {
      setLoadError("Older comparisons could not be loaded. Try again.")
    } finally {
      setIsLoadingOlder(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        data-slot="change-feed-filters"
        className="sticky top-0 z-30 -mx-4 bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <ChangeFilters key={`${filters.target ?? ""}:${filters.category ?? ""}`} initialFilters={filters} />
      </div>

      {comparisons.length > 0 ? (
        <>
          <ChangeComparisonTimeline
            variant="summary"
            comparisons={comparisons}
            category={filters.category}
            onSelect={openChange}
          />

          {isLoadingDetail ? <p role="status" className="sr-only">Loading change details</p> : null}
          {detailError ? <p role="alert" className="text-right text-sm text-destructive">{detailError}</p> : null}
          {loadError ? <p role="alert" className="text-right text-sm text-destructive">{loadError}</p> : null}
          {nextCursor ? (
            <div className="flex justify-center">
              <Button type="button" size="sm" variant="outline" onClick={loadOlder} disabled={isLoadingOlder}>
                {isLoadingOlder ? "Loading older comparisons..." : "Load older comparisons"}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <Card>
          <CardContent>
            <Empty className="min-h-56">
              <EmptyHeader>
                <EmptyMedia variant="icon"><GitCompareArrows aria-hidden="true" /></EmptyMedia>
                <EmptyTitle>No matching changes yet</EmptyTitle>
                <EmptyDescription>Run the same target twice with compatible settings. Stackray will preserve the comparison here automatically.</EmptyDescription>
              </EmptyHeader>
              {filters.target || filters.category ? (
                <EmptyContent><Button asChild variant="outline" size="sm"><Link href="/changes">Clear filters</Link></Button></EmptyContent>
              ) : null}
            </Empty>
          </CardContent>
        </Card>
      )}

      {selectedChange && selectedComparison ? (
        <ChangeDetailModal
          comparison={selectedComparison}
          initialItemId={selectedChange.itemId}
          onClose={() => {
            detailRequestId.current += 1
            setSelectedChange(null)
            setSelectedComparison(null)
          }}
        />
      ) : null}
    </div>
  )
}
