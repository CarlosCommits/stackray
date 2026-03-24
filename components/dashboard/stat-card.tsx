import { Card } from "@/components/ui/card"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Stat } from "@/components/dashboard/types"

interface StatCardProps {
  stat: Stat
}

export function StatCard({ stat }: StatCardProps) {
  const renderIndicator = () => {
    switch (stat.indicator) {
      case "trend-up":
        return (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            {stat.change && (
              <span className="text-[10px] font-mono text-emerald-400">{stat.change}</span>
            )}
          </div>
        )
      case "trend-down":
        return (
          <div className="flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" />
            {stat.change && (
              <span className="text-[10px] font-mono text-red-400">{stat.change}</span>
            )}
          </div>
        )
      case "pulse":
        return (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-[var(--accent)]" />
            <div className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:150ms]" />
              <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        )
      case "static":
      default:
        return stat.change ? (
          <div className="flex items-center gap-1">
            <Minus className="w-3 h-3 text-[var(--text-dim)]" />
            <span className="text-[10px] font-mono text-[var(--text-dim)]">{stat.change}</span>
          </div>
        ) : null
    }
  }

  return (
    <Card className="col-span-3 bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-4 relative min-h-[100px] flex flex-col">
      {/* Header: Label + Indicator */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-[var(--font-heading)] uppercase tracking-wider text-[var(--text-dim)]">
          {stat.label}
        </span>
        {renderIndicator()}
      </div>

      {/* Main Value */}
      <div className="flex items-baseline gap-2 mb-1">
        <h3 className="font-[var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">
          {stat.value}
        </h3>
        {stat.subvalue && (
          <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
            {stat.subvalue}
          </span>
        )}
      </div>

      {/* Footer Meta */}
      {stat.meta && (
        <div className="mt-auto pt-2 border-t border-[var(--gray-border)]/50">
          <span className="text-[9px] font-mono text-[var(--text-dim)]/70">
            {stat.meta}
          </span>
        </div>
      )}
    </Card>
  )
}
