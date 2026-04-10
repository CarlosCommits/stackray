import type { Stat } from "@/components/dashboard/types"
import { StatCard } from "@/components/dashboard/stat-card"

interface OverviewMetricsProps {
  stats: Stat[]
}

export function OverviewMetrics({ stats }: OverviewMetricsProps) {
  return (
    <div data-tour="dashboard-stats" className="col-span-12 grid grid-cols-12 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  )
}
