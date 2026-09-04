import Link from "next/link"
import {
  Activity,
  CheckCircle2,
} from "lucide-react"
import { notFound } from "next/navigation"

import { getChangePreview } from "@/components/changes/change-presentation"
import { BaselineInfoPopover } from "@/components/targets/profile/baseline-info-popover"
import { RecentChangeList } from "@/components/targets/profile/recent-change-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocalTime, RelativeTime } from "@/components/ui/local-time"
import { requireAppSession } from "@/lib/session/app-session"
import { getTargetOverview } from "@/lib/server/targets/profile-service"
import { cn } from "@/lib/utils"

function statusClassName(statusCode: number | null) {
  if (statusCode === null) return "text-muted-foreground"
  return statusCode >= 200 && statusCode < 400 ? "text-emerald-300" : "text-orange-300"
}

function scheduleLabel(frequency: "daily" | "weekly" | "monthly") {
  return frequency[0]?.toUpperCase() + frequency.slice(1)
}

export default async function TargetOverviewPage({ params }: { params: Promise<{ targetId: string }> }) {
  const [session, { targetId }] = await Promise.all([requireAppSession(), params])
  const data = await getTargetOverview(session, targetId)

  if (!data.identity) {
    notFound()
  }

  const { identity, monitoring } = data
  const primarySchedule = monitoring.schedules.find((schedule) => schedule.enabled) ?? monitoring.schedules[0] ?? null
  const latestComparison = data.recentChanges[0] ?? null
  const recentChangeItems = latestComparison?.items.slice(0, 3).map((item) => ({
    id: item.id,
    category: item.category,
    changeType: item.changeType,
    summary: item.summary,
    preview: getChangePreview(item, identity.target),
  })) ?? []

  return (
    <div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-y-0">
      <section className="min-w-0 p-4 sm:p-6 lg:border-b lg:border-r" aria-labelledby="target-current-state">
        <h3 id="target-current-state" className="font-heading text-base font-semibold tracking-tight text-foreground">Current state</h3>
        <dl className="mt-4 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:mt-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-5 sm:gap-y-3.5">
          <dt className="text-muted-foreground">Last scanned</dt>
          <dd><RelativeTime value={identity.lastScannedAt} /></dd>
          <dt className="text-muted-foreground">HTTP status</dt>
          <dd className={`font-mono ${statusClassName(identity.statusCode)}`}>{identity.statusCode ?? "Not available"}</dd>
          <dt className="text-muted-foreground">Resolved IP</dt>
          <dd className="font-mono text-muted-foreground">{identity.hostIp ?? "Not observed"}</dd>
          <dt className="text-muted-foreground">Technologies</dt>
          <dd className="flex min-w-0 flex-col gap-0.5 text-muted-foreground sm:hidden">
            {identity.technologies.length > 0 ? (
              <>
                <span className="line-clamp-2 leading-5">{identity.technologies.slice(0, 2).join(" · ")}</span>
                {identity.technologies.length > 2 ? <span>+{identity.technologies.length - 2} more</span> : null}
              </>
            ) : <span>None detected</span>}
          </dd>
          <dd className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
            {identity.technologies.length > 0
              ? identity.technologies.slice(0, 3).map((technology) => <Badge key={technology} variant="outline" className="font-normal">{technology}</Badge>)
              : <span className="text-muted-foreground">None detected</span>}
            {identity.technologies.length > 3 ? <span className="ml-1 text-muted-foreground">+{identity.technologies.length - 3} more</span> : null}
          </dd>
          <dt className="text-muted-foreground">TLS</dt>
          <dd className={identity.tlsObserved ? "text-emerald-300" : "text-muted-foreground"}>
            {identity.tlsObserved ? "Certificate observed" : "Not observed"}
          </dd>
        </dl>
      </section>

      <section className="min-w-0 p-4 sm:p-6 lg:border-b" aria-labelledby="target-monitoring-summary">
        <div className="flex items-center justify-between gap-3">
          <h3 id="target-monitoring-summary" className="font-heading text-base font-semibold tracking-tight text-foreground">Monitoring</h3>
          <Button asChild variant="link" size="sm" className="h-auto px-0 text-[var(--accent)]">
            <Link href={`/targets/${targetId}/monitoring`}>Configure</Link>
          </Button>
        </div>
        <dl className="mt-4 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm sm:mt-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-5 sm:gap-y-3.5">
          <dt className="text-muted-foreground">Schedule</dt>
          <dd>{primarySchedule ? scheduleLabel(primarySchedule.frequency) : "No recurring schedule"}</dd>
          <dt className="text-muted-foreground">Baseline</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <span className="text-[var(--accent)]">{monitoring.baselineMode === "pinned" ? "Pinned scan" : "Automatic"}</span>
            <BaselineInfoPopover baselineMode={monitoring.baselineMode} />
          </dd>
        </dl>
      </section>

      <section className="flex min-w-0 flex-col p-4 sm:p-6 lg:border-r" aria-labelledby="recent-target-changes">
        <div className="flex items-center justify-between gap-4">
          <h3 id="recent-target-changes" className="font-heading text-base font-semibold tracking-tight text-foreground">Recent changes</h3>
          {latestComparison ? (
            <span className="text-xs text-muted-foreground">
              {latestComparison.counts.total} {latestComparison.counts.total === 1 ? "change" : "changes"} ·{" "}
              <RelativeTime value={latestComparison.currentScan.completedAt} />
            </span>
          ) : null}
        </div>
        {latestComparison && recentChangeItems.length > 0 ? (
          <RecentChangeList comparisonId={latestComparison.id} items={recentChangeItems} />
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No changes have been detected for this target yet.</p>
        )}
        <Button asChild variant="link" size="sm" className="mt-auto h-auto self-start px-0 pt-2 text-[var(--accent)]">
          <Link href={`/targets/${targetId}/changes`}>View all changes</Link>
        </Button>
      </section>

      <section className="flex min-w-0 flex-col p-4 sm:p-6" aria-labelledby="target-scan-activity">
        <h3 id="target-scan-activity" className="font-heading text-base font-semibold tracking-tight text-foreground">Scan activity</h3>
        <div className="mt-3 grid gap-x-6 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-4">
          {data.recentScans.map((scan, index) => (
            <Link
              key={scan.scanId}
              href={`/scans/${scan.scanId}`}
              className={cn(
                "group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/20",
                index >= 4 && "hidden sm:flex",
              )}
            >
              {scan.status === "completed"
                ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                : <Activity className="size-4 shrink-0 text-orange-300" aria-hidden="true" />}
              <span className="shrink-0 capitalize">{scan.status}</span>
              <LocalTime value={scan.completedAt ?? scan.submittedAt} preset="compactDateTimeWithZone" className="text-xs text-muted-foreground" />
            </Link>
          ))}
        </div>
        {data.recentScans.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No scans yet.</p> : null}
        <Button asChild variant="link" size="sm" className="mt-auto h-auto self-start px-0 pt-2 text-[var(--accent)]">
          <Link href={`/targets/${targetId}/scans`}>View all scans</Link>
        </Button>
      </section>
    </div>
  )
}
