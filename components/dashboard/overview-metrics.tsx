import type { Stat } from "@/components/dashboard/types"
import { StatCard } from "@/components/dashboard/stat-card"

interface OverviewMetricsProps {
  stats: Stat[]
}

export function OverviewMetrics({ stats }: OverviewMetricsProps) {
  return (
    <>
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </>
  )
}
