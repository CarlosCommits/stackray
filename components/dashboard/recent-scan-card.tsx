import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Activity,
  Globe,
  Server,
  Zap,
  ArrowRightLeft
} from "lucide-react"
import type { RecentScan } from "@/components/dashboard/types"

interface RecentScanCardProps {
  scan: RecentScan
}

function getStatusBadge(status: RecentScan["status"]) {
  switch (status) {
    case "complete":
      return (
        <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-emerald-500/40 text-emerald-400 rounded-full font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Done
        </Badge>
      )
    case "analyzing":
      return (
        <Badge className="text-[9px] px-2 py-0.5 bg-[var(--accent)] text-[var(--primary-foreground)] rounded-full font-medium flex items-center gap-1">
          <Activity className="w-3 h-3" />
          Active
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="outline" className="text-[9px] px-2 py-0.5 border-red-500/40 text-red-400 rounded-full font-medium">
          <AlertCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      )
  }
}

function getStatusBorder(status: RecentScan["status"]) {
  switch (status) {
    case "complete":
      return "border-emerald-500/10"
    case "analyzing":
      return "border-[var(--accent)]/30"
    case "failed":
      return "border-red-500/20"
    default:
      return "border-[var(--gray-border)]"
  }
}

function SummaryRow({ scan }: { scan: RecentScan }) {
  if (scan.status === "failed") {
    return (
      <div className="flex items-center gap-2 text-[10px] text-red-400/80">
        <AlertCircle className="w-3 h-3" />
        <span className="truncate">{scan.error}</span>
      </div>
    )
  }

  if (scan.status === "analyzing") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Progress value={scan.progress || 0} className="h-1 bg-[var(--gray-border)]" />
        </div>
        <span className="text-[10px] font-mono text-[var(--accent)] w-8 text-right">
          {scan.progress}%
        </span>
      </div>
    )
  }

  // Complete scan - show rich summary
  return (
    <div className="flex items-center gap-3 text-[10px] font-mono">
      {scan.statusCode && (
        <span className={`px-1.5 py-0.5 rounded ${scan.statusCode < 400 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
          {scan.statusCode}
        </span>
      )}
      {scan.server && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <Server className="w-3 h-3" />
          {scan.server}
        </span>
      )}
      {scan.cdn && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <Zap className="w-3 h-3" />
          {scan.cdn}
        </span>
      )}
      {scan.redirectCount !== undefined && scan.redirectCount > 0 && (
        <span className="flex items-center gap-1 text-[var(--text-dim)]">
          <ArrowRightLeft className="w-3 h-3" />
          {scan.redirectCount} redirect{scan.redirectCount > 1 ? 's' : ''}
        </span>
      )}
      {scan.responseTimeMs && (
        <span className="text-[var(--text-dim)] ml-auto">
          {scan.responseTimeMs}ms
        </span>
      )}
    </div>
  )
}

export function RecentScanCard({ scan }: RecentScanCardProps) {
  const techDisplayCount = 3
  const visibleTechs = scan.technologies?.slice(0, techDisplayCount) || []
  const remainingTechs = (scan.technologies?.length || 0) - techDisplayCount

  return (
    <Card className={`bg-[var(--surface-mid)] widget-outline p-4 relative rounded-lg flex flex-col gap-3 ${getStatusBorder(scan.status)}`}>
      {/* Header: Target (prominent) + Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <h4 className="font-mono text-sm font-bold text-[var(--foreground)] truncate">
              {scan.target}
            </h4>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
            <span>{scan.ip}</span>
            <span className="text-[var(--gray-border)]">|</span>
            <span>{scan.timestamp}</span>
          </div>
        </div>
        <div className="shrink-0">
          {getStatusBadge(scan.status)}
        </div>
      </div>

      {/* Summary Row - state-specific content */}
      <div className="min-h-[20px]">
        <SummaryRow scan={scan} />
      </div>

      {/* Technologies - quieter presentation */}
      {visibleTechs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleTechs.map((tech) => (
            <span
              key={tech}
              className="text-[9px] px-1.5 py-0.5 bg-[var(--surface-light)]/50 text-[var(--text-dim)] border border-[var(--gray-border)]/50 rounded"
            >
              {tech}
            </span>
          ))}
          {remainingTechs > 0 && (
            <span className="text-[9px] text-[var(--text-dim)]/60">
              +{remainingTechs} more
            </span>
          )}
        </div>
      )}

      {/* Footer: Purposeful actions */}
      <div className="mt-auto pt-3 border-t border-[var(--gray-border)]/50 flex items-center justify-between">
        <span className="text-[9px] font-mono text-[var(--text-dim)]/50 uppercase tracking-wider">
          {scan.status === "complete" && scan.techCount 
            ? `${scan.techCount} technologies detected`
            : scan.status === "analyzing" 
              ? "Analysis in progress..."
              : scan.status === "failed"
                ? "Retry available"
                : ""
          }
        </span>
        
        <div className="flex items-center gap-2">
          {scan.status === "complete" && (
            <Link 
              href={`/scans/${scan.id}`} 
              className="flex items-center gap-1 text-[10px] font-mono text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors"
            >
              View Details
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          {scan.status === "analyzing" && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-dim)]">
              <Activity className="w-3 h-3 animate-pulse" />
              Running
            </span>
          )}
          {scan.status === "failed" && (
            <button className="flex items-center gap-1 text-[10px] font-mono text-red-400 hover:text-red-300 transition-colors">
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
