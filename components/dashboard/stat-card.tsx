import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Stat } from "@/components/dashboard/types"

interface StatCardProps {
  stat: Stat
}

export function StatCard({ stat }: StatCardProps) {
  const showsActiveIndicator = stat.indicator === "pulse"
    ? ((stat.inFlight ?? Number(stat.value)) || 0) > 0
    : true

  const renderIndicator = () => {
    switch (stat.indicator) {
      case "trend-up":
        return (
          <div className="flex items-center gap-1">
            <TrendingUp className="size-3 text-emerald-400" />
            {stat.change && (
              <span className="text-[11px] font-mono text-emerald-400">{stat.change}</span>
            )}
          </div>
        )
      case "trend-down":
        return (
          <div className="flex items-center gap-1">
            <TrendingDown className="size-3 text-red-400" />
            {stat.change && (
              <span className="text-[11px] font-mono text-red-400">{stat.change}</span>
            )}
          </div>
        )
      case "pulse":
        if (!showsActiveIndicator) {
          return null
        }

        return (
          <div className="flex items-center gap-1.5">
            <Activity className="size-3 text-[var(--accent)]" />
            <div className="flex gap-0.5">
              <span className="size-1 rounded-full bg-[var(--accent)] motion-safe:animate-pulse" />
              <span className="size-1 rounded-full bg-[var(--accent)] motion-safe:animate-pulse [animation-delay:150ms]" />
              <span className="size-1 rounded-full bg-[var(--accent)] motion-safe:animate-pulse [animation-delay:300ms]" />
            </div>
          </div>
        )
      case "static":
      default:
        return stat.change ? (
          <div className="flex items-center gap-1">
            <Minus className="size-3 text-[var(--text-dim)]" />
            <span className="text-[11px] font-mono text-[var(--text-dim)]">{stat.change}</span>
          </div>
        ) : null
    }
  }

  const cardContent = (
    <Card className="col-span-6 lg:col-span-3 bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-4 relative flex min-h-[112px] flex-col">
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[11px] font-heading uppercase tracking-wider text-[var(--text-dim)]">
          {stat.label}
        </span>
        {renderIndicator()}
      </div>

      <div className="mb-1 flex items-end gap-2">
        <h3 className="font-heading text-3xl font-bold leading-none text-[var(--foreground)] tabular-nums xl:text-4xl">
          {stat.value}
        </h3>
        {stat.subvalue && (
          <span className="pb-1 text-[11px] font-mono text-[var(--text-dim)] uppercase">
            {stat.subvalue}
          </span>
        )}
      </div>

      {stat.meta && (
        <div className="mt-auto pt-2 border-t border-[var(--gray-border)]/50">
          <span className="text-[11px] font-mono text-[var(--text-dim)]/80">
            {stat.meta}
          </span>
        </div>
      )}
    </Card>
  )

  if (!stat.href) {
    return cardContent
  }

  return (
    <Link href={stat.href} className="col-span-6 lg:col-span-3 block">
      <div className="contents">{cardContent}</div>
    </Link>
  )
}
