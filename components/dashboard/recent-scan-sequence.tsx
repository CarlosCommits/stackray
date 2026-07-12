"use client"

import { ChevronDown, ScanLine, ScanSearch } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import type { RecentScan } from "@/components/dashboard/types"
import { RecentScanCard } from "@/components/dashboard/recent-scan-card"
import { Button } from "@/components/ui/button"

interface RecentScanSequenceProps {
  scans: RecentScan[]
  hasMore?: boolean
  isLoadingMore?: boolean
  loadMoreError?: string | null
  onLoadMore?: () => void
}

export function RecentScanSequence({
  scans,
  hasMore = false,
  isLoadingMore = false,
  loadMoreError = null,
  onLoadMore,
}: RecentScanSequenceProps) {
  const hasScans = scans.length > 0
  const shouldReduceMotion = useReducedMotion()

  return (
    <div className="col-span-12 mt-4 flex flex-col gap-4 lg:mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--gray-border)] pb-2">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          <ScanSearch aria-hidden="true" className="size-4" />
          Recent Scans
        </h2>
        {hasScans ? (
          <p className="font-mono text-[10px] text-[var(--text-dim)] sm:text-[11px]">
            <span className="sm:hidden">Tap a card to open</span>
            <span className="hidden sm:inline">Select a scan to view details</span>
          </p>
        ) : null}
      </div>

      {hasScans ? (
        <>
          <div className="relative grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3 min-[1400px]:!grid-cols-4">
            <AnimatePresence initial={false} mode="popLayout">
              {scans.map((scan) => (
                <motion.div
                  key={scan.id}
                  layout
                  className="min-w-0"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -14 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 10 }}
                  transition={{
                    layout: { duration: shouldReduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] },
                    duration: shouldReduceMotion ? 0 : 0.24,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <RecentScanCard scan={scan} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="group min-w-44 rounded-lg border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] px-4 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--foreground)] shadow-[0_14px_34px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-[var(--surface-mid)]/45 hover:text-[var(--foreground)]"
              >
                <ChevronDown className="size-3.5 text-[var(--accent)] transition-transform group-hover/button:translate-y-0.5" />
                {isLoadingMore ? "Loading" : "Load More"}
              </Button>
            </div>
          ) : null}
          {loadMoreError ? (
            <p className="text-center font-mono text-[11px] text-red-300">
              {loadMoreError}
            </p>
          ) : null}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-[var(--gray-border)] rounded-lg bg-[var(--surface-mid)]/50">
          <ScanLine className="size-8 text-[var(--text-dim)]/40 mb-3" />
          <p className="text-sm font-mono text-[var(--text-dim)]">No recent scans</p>
          <p className="text-[11px] text-[var(--text-dim)]/60 mt-1">Run your first scan to see results here</p>
        </div>
      )}
    </div>
  )
}
