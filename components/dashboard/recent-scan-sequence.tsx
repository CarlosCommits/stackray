import Link from "next/link"
import { Activity, ScanLine } from "lucide-react"

import type { RecentScan } from "@/components/dashboard/types"
import { RecentScanCard } from "@/components/dashboard/recent-scan-card"

interface RecentScanSequenceProps {
  scans: RecentScan[]
}

export function RecentScanSequence({ scans }: RecentScanSequenceProps) {
  const hasScans = scans.length > 0

  return (
    <div className="col-span-12 mt-4 flex flex-col gap-4 lg:mt-6">
      <div className="flex items-center justify-between border-b border-[var(--gray-border)] pb-2">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
          <Activity className="w-4 h-4" />
          RECENT_SCAN_SEQUENCE
        </h2>
        <Link
          href="/runs"
          className="text-[11px] text-[var(--text-dim)] hover:text-[var(--accent)] font-heading uppercase tracking-wider transition-colors"
        >
          View_Runs
        </Link>
      </div>

      {hasScans ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {scans.map((scan) => (
            <RecentScanCard key={scan.id} scan={scan} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-[var(--gray-border)] rounded-lg bg-[var(--surface-mid)]/50">
          <ScanLine className="w-8 h-8 text-[var(--text-dim)]/40 mb-3" />
          <p className="text-sm font-mono text-[var(--text-dim)]">No recent scans</p>
          <p className="text-[11px] text-[var(--text-dim)]/60 mt-1">Run your first scan to see results here</p>
        </div>
      )}
    </div>
  )
}
