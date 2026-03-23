import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, RefreshCw } from "lucide-react"
import type { RecentScan } from "@/components/dashboard/types"

interface RecentScanCardProps {
  scan: RecentScan
}

export function RecentScanCard({ scan }: RecentScanCardProps) {
  return (
    <Card
      className={`bg-[var(--surface-mid)] widget-outline p-4 relative rounded-lg flex flex-col ${
        scan.status === "analyzing" ? "border-[var(--accent)]/30" : ""
      }`}
    >
      {/* Header: Target + Status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-mono text-sm text-[var(--foreground)] font-bold truncate">{scan.target}</h4>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">{scan.ip}</span>
        </div>
        <div className="shrink-0">
          {scan.status === "complete" && (
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-[var(--accent)]/50 text-[var(--accent)] rounded-full font-bold">
              DONE
            </Badge>
          )}
          {scan.status === "analyzing" && (
            <Badge className="text-[9px] px-2 py-0.5 bg-[var(--accent)] text-[var(--primary-foreground)] rounded-full font-bold flex items-center gap-1">
              <span className="w-1 h-1 bg-[var(--primary-foreground)] rounded-full animate-ping" />
              ACTIVE
            </Badge>
          )}
          {scan.status === "failed" && (
            <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-red-500/50 text-red-400 rounded-full font-bold">
              FAIL
            </Badge>
          )}
        </div>
      </div>

      {/* Body: Technologies or Error */}
      {scan.technologies ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {scan.technologies.slice(0, 4).map((tech) => (
            <span
              key={tech}
              className="text-[9px] px-1.5 py-0.5 bg-[var(--surface-light)] text-[var(--foreground)]/80 border border-[var(--gray-border)] rounded"
            >
              {tech}
            </span>
          ))}
          {scan.technologies.length > 4 && (
            <span className="text-[9px] px-1.5 py-0.5 text-[var(--text-dim)]">
              +{scan.technologies.length - 4}
            </span>
          )}
        </div>
      ) : (
        <div className="mb-3">
          <span className="text-[10px] font-mono text-red-400/80 italic">{scan.error}</span>
        </div>
      )}

      {/* Footer: Timestamp + Action */}
      <div className="mt-auto flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)] border-t border-[var(--gray-border)] pt-2.5">
        <span>{scan.timestamp}</span>
        <div className="flex items-center">
          {scan.status === "complete" && (
            <Link href={`/scans/${scan.id}`} className="hover:text-[var(--accent)] transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
          {scan.status === "analyzing" && scan.progress && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--accent)]">{scan.progress}%</span>
              <div className="h-1 w-16 bg-[var(--gray-border)] rounded overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)]"
                  style={{ width: `${scan.progress}%` }}
                />
              </div>
            </div>
          )}
          {scan.status === "failed" && (
            <RefreshCw className="w-3.5 h-3.5 text-red-400 hover:text-red-300 cursor-pointer transition-colors" />
          )}
        </div>
      </div>
    </Card>
  )
}
