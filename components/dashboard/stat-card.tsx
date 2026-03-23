import { Card } from "@/components/ui/card"
import { Activity } from "lucide-react"
import type { Stat } from "@/components/dashboard/types"

interface StatCardProps {
  stat: Stat
}

export function StatCard({ stat }: StatCardProps) {
  return (
    <Card className="col-span-3 bg-[var(--surface-dark)] border-[var(--gray-border)] widget-outline p-3 relative min-h-[120px]">
      <div className="flex flex-col h-full justify-between">
        <div>
          <span className="text-[10px] font-[var(--font-heading)] uppercase tracking-wider text-[var(--text-dim)] block mb-1">
            {stat.label}
          </span>
          <h3 className="font-[var(--font-heading)] text-2xl font-bold data-value text-[var(--foreground)]">
            {stat.value}
          </h3>
        </div>

        {stat.change && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-mono text-[var(--accent)]">{stat.change}</span>
            <div className="w-1/2 h-0.5 bg-[var(--gray-border)] relative overflow-hidden">
              <div
                className="absolute inset-0 bg-[var(--accent)]"
                style={{ width: `${stat.progress}%` }}
              />
            </div>
          </div>
        )}

        {stat.bars && (
          <div className="flex gap-1 mt-2">
            {stat.bars.map((width) => (
              <div
                key={`${stat.label}-bar-${width}`}
                className="h-1 flex-1 bg-[var(--accent)]"
                style={{ opacity: width / 100 }}
              />
            ))}
          </div>
        )}

        {stat.latest && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-mono text-[var(--text-dim)]">LATEST:</span>
            <span className="text-[10px] font-mono text-[var(--accent)]">{stat.latest}</span>
          </div>
        )}

        {stat.inFlight !== undefined && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[10px] font-mono text-[var(--text-dim)]">{stat.status}</span>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: Math.min(stat.inFlight, 5) }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {stat.status && stat.inFlight === undefined && (
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-dim)] mt-2">
            <span>{stat.status}</span>
            <span className="text-[var(--accent)]">{stat.uptime}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
