import Link from "next/link"
import { Bell, CalendarClock, type LucideIcon } from "lucide-react"

import { BaselineSettings } from "@/components/targets/profile/baseline-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocalTime } from "@/components/ui/local-time"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { requireAppSession } from "@/lib/session/app-session"
import { getTargetMonitoring } from "@/lib/server/targets/profile-service"

function frequencyLabel(frequency: "daily" | "weekly" | "monthly") {
  return frequency[0]?.toUpperCase() + frequency.slice(1)
}

function MonitoringCardHeader({
  description,
  headingId,
  icon: Icon,
  active,
  title,
}: {
  description: string
  headingId: string
  icon: LucideIcon
  active: boolean
  title: string
}) {
  return (
    <CardHeader>
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 size-5 shrink-0",
            active ? "text-[var(--accent)]" : "text-muted-foreground",
          )}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <CardTitle><h3 id={headingId}>{title}</h3></CardTitle>
          <CardDescription className="mt-1 leading-6">{description}</CardDescription>
        </div>
      </div>
      <Separator className="mt-3 bg-border/50" />
    </CardHeader>
  )
}

export default async function TargetMonitoringPage({ params }: { params: Promise<{ targetId: string }> }) {
  const [session, { targetId }] = await Promise.all([requireAppSession(), params])
  const monitoring = await getTargetMonitoring(session, targetId)
  const hasEnabledSchedule = monitoring.schedules.some((schedule) => schedule.enabled)
  const hasReadyAlertPolicy = (monitoring.alertCoverage?.readyPolicyCount ?? 0) > 0

  return (
    <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)] lg:items-stretch">
      <Card className="h-full py-0">
        <CardContent className="h-full p-5 sm:p-6">
          <BaselineSettings
            targetId={targetId}
            mode={monitoring.baselineMode}
            pinnedScanId={monitoring.pinnedBaselineScanId}
            options={monitoring.baselineOptions}
            canManage={monitoring.canManageBaseline}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card role="region" aria-labelledby="monitoring-schedules-heading">
          <MonitoringCardHeader
            headingId="monitoring-schedules-heading"
            icon={CalendarClock}
            active={hasEnabledSchedule}
            title="Recurring schedule"
            description="Schedules that currently include this target."
          />
          <CardContent className="flex flex-1 flex-col gap-4">
            {monitoring.schedules.length > 0 ? (
              <div className="flex flex-col gap-3">
                {monitoring.schedules.map((schedule, index) => (
                  <div key={schedule.id} className="flex flex-col gap-3">
                    {index > 0 ? <Separator /> : null}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-medium text-foreground">{frequencyLabel(schedule.frequency)}</span>
                      {schedule.enabled ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                          Enabled
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Disabled</span>
                      )}
                      <span className="w-full text-xs text-muted-foreground">
                        Next <LocalTime value={schedule.nextRunAt} preset="compactDateTimeWithZone" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">No recurring schedule</p>
                <p className="text-sm leading-6 text-muted-foreground">This target is not part of a recurring schedule.</p>
              </div>
            )}
            <Button asChild variant="outline" className="mt-auto self-start">
              <Link href="/schedules">
                <CalendarClock data-icon="inline-start" aria-hidden="true" />
                Manage schedules
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card role="region" aria-labelledby="target-alerts-heading">
          <MonitoringCardHeader
            headingId="target-alerts-heading"
            icon={Bell}
            active={hasReadyAlertPolicy}
            title="Alerts"
            description="Policies that can notify for this target."
          />
          <CardContent className="flex flex-1 flex-col gap-4">
            {monitoring.alertCoverage ? (
              monitoring.alertCoverage.coveredPolicyCount > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium",
                    hasReadyAlertPolicy ? "text-emerald-400" : "text-amber-300",
                  )}>
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        hasReadyAlertPolicy ? "bg-emerald-400" : "bg-amber-300",
                      )}
                      aria-hidden="true"
                    />
                    Covered by {monitoring.alertCoverage.coveredPolicyCount} enabled {monitoring.alertCoverage.coveredPolicyCount === 1 ? "policy" : "policies"}
                  </p>
                  {monitoring.alertCoverage.readyPolicyCount === 0 ? (
                    <p className="text-sm leading-6 text-muted-foreground">Connect an enabled notification channel before relying on alerts.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">No enabled alert policies cover this target.</p>
              )
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">Alert policies are managed by an administrator.</p>
            )}
            {monitoring.canManageAlerts ? (
              <Button asChild variant="outline" className="mt-auto self-start">
                <Link href="/settings/alerts">
                  <Bell data-icon="inline-start" aria-hidden="true" />
                  Open alert settings
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
