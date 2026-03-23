import Link from "next/link"
import { Activity } from "lucide-react"

import type { RecentScan } from "@/components/dashboard/types"
import { RecentScanCard } from "@/components/dashboard/recent-scan-card"

interface RecentScanSequenceProps {
  scans: RecentScan[]
}

export function RecentScanSequence({ scans }: RecentScanSequenceProps) {
  return (
    <div className="col-span-12 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-[var(--gray-border)] pb-2">
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)]">
          <Activity className="w-4 h-4" />
          RECENT_SCAN_SEQUENCE
        </h2>
        <Link
          href="/history"
          className="text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] font-[var(--font-heading)] uppercase transition-colors"
        >
          View_Logs
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {scans.map((scan) => (
          <RecentScanCard key={scan.id} scan={scan} />
        ))}
      </div>
    </div>
  )
}
