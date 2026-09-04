"use client"

import Link from "next/link"
import { CheckCircle2, MoveRight } from "lucide-react"

import {
  ChangeTypeIcon,
  getChangePreview,
  getChangeTitle,
} from "@/components/changes/change-presentation"
import { ChangeTargetIcon } from "@/components/changes/change-target-icon"
import { SelectedComparisonSection } from "@/components/changes/selected-comparison-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LocalTime } from "@/components/ui/local-time"
import { Separator } from "@/components/ui/separator"
import { useTimeZone } from "@/components/ui/time-zone-provider"
import type {
  ChangeCategory,
  ChangeFeedComparison,
  ChangeFeedItem,
  ScanChangeItem,
  ScanComparison,
} from "@/lib/contracts/changes"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { formatDateOnlyInTimeZone } from "@/lib/time"
import { cn } from "@/lib/utils"
import { trackStackrayEvent } from "@/lib/analytics"

const CHANGE_CATEGORY_LABELS: Record<ChangeCategory, string> = {
  availability: "Availability",
  content: "Content",
  infrastructure: "Infrastructure",
  tls: "TLS",
  technology: "Technology",
  discovery: "Discovery",
  security: "Security",
}

export type SelectedChange = {
  comparisonId: string
  itemId: string
}

type TimelineComparison = ScanComparison | ChangeFeedComparison
type TimelineChangeItem = ScanChangeItem | ChangeFeedItem

type ComparisonDay = {
  key: string
  headingValue: string | null
  comparisons: TimelineComparison[]
}

type SummaryTimelineProps = {
  variant: "summary"
  comparisons: ChangeFeedComparison[]
  category: ChangeCategory | null
  onSelect: (selection: SelectedChange) => void
}

type TargetTimelineProps = {
  variant: "target"
  comparisons: ScanComparison[]
  basePath: string
  category: ChangeCategory | null
  selectedComparisonId: string | null
  selectedItemId: string | null
}

type ChangeComparisonTimelineProps = SummaryTimelineProps | TargetTimelineProps

function targetProfileHref(comparison: TimelineComparison) {
  if (!comparison.canonicalTargetId) return `/scans/${comparison.currentScan.id}`
  return `/targets/${comparison.canonicalTargetId}/changes`
}

export function targetComparisonHref(comparison: TimelineComparison, category: ChangeCategory | null = null) {
  if (!comparison.canonicalTargetId) return `/scans/${comparison.currentScan.id}`
  const params = new URLSearchParams()
  if (category) params.set("category", category)
  params.set("comparison", comparison.id)
  return `/targets/${comparison.canonicalTargetId}/changes?${params.toString()}#comparison-${comparison.id}`
}

export function targetChangeItemHref({
  basePath,
  category,
  comparisonId,
  itemId,
}: {
  basePath: string
  category: ChangeCategory | null
  comparisonId: string
  itemId: string
}) {
  const params = new URLSearchParams()
  if (category) params.set("category", category)
  params.set("comparison", comparisonId)
  params.set("item", itemId)
  return `${basePath}?${params.toString()}#comparison-${comparisonId}`
}

function groupComparisonsByDay(comparisons: TimelineComparison[], timeZone: string | null) {
  const groups = new Map<string, ComparisonDay>()

  for (const comparison of comparisons) {
    const completedAt = comparison.currentScan.completedAt
    const dayKey = formatDateOnlyInTimeZone(completedAt, timeZone ?? "UTC") ?? "unknown"
    const existing = groups.get(dayKey)

    if (existing) {
      existing.comparisons.push(comparison)
      continue
    }

    groups.set(dayKey, {
      key: dayKey,
      headingValue: completedAt,
      comparisons: [comparison],
    })
  }

  return [...groups.values()]
}

function ChangeRowContent({ item, target }: { item: TimelineChangeItem; target: string }) {
  const preview = "preview" in item ? item.preview : getChangePreview(item, target)

  return (
    <>
      <ChangeTypeIcon
        changeType={item.changeType}
        className="size-6 shrink-0 transition-transform group-hover/change:scale-105"
      />
      <span className="min-w-0 truncate text-base font-semibold text-foreground">
        {getChangeTitle(item)}
      </span>
      {preview ? (
        <span className="col-start-2 min-w-0 truncate text-sm leading-5 text-muted-foreground md:col-start-auto">
          {preview}
        </span>
      ) : <span className="hidden md:block" />}
      <span className="hidden text-sm text-muted-foreground xl:block">
        {CHANGE_CATEGORY_LABELS[item.category]}
      </span>
    </>
  )
}

const changeRowClassName = "group/change grid w-full min-w-0 cursor-pointer grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-4 gap-y-1 px-5 py-4 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:grid-cols-[2rem_minmax(14rem,.8fr)_minmax(16rem,1.2fr)] xl:grid-cols-[2rem_minmax(14rem,.8fr)_minmax(18rem,1.2fr)_8.5rem]"

function ChangeRow({
  item,
  comparison,
  action,
}: {
  item: TimelineChangeItem
  comparison: TimelineComparison
  action:
    | { type: "button"; onSelect: (selection: SelectedChange) => void }
    | { type: "link"; href: string }
}) {
  const title = getChangeTitle(item)
  const content = <ChangeRowContent item={item} target={comparison.currentScan.target} />

  if (action.type === "link") {
    return (
      <Link
        href={action.href}
        scroll={false}
        className={changeRowClassName}
        onClick={() => trackStackrayEvent("change_detail_opened", { source: "target_changes" })}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        trackStackrayEvent("change_detail_opened", { source: "changes_feed" })
        action.onSelect({ comparisonId: comparison.id, itemId: item.id })
      }}
      className={changeRowClassName}
      aria-label={title}
    >
      {content}
    </button>
  )
}

function ComparisonFlow({
  comparison,
  headingId,
  className,
}: {
  comparison: TimelineComparison
  headingId?: string
  className?: string
}) {
  return (
    <div
      id={headingId}
      data-slot="comparison-flow"
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-x-1.5 text-xs text-foreground/90 sm:gap-x-3 sm:text-sm",
        className,
      )}
    >
      <span className="sr-only">Baseline</span>
      <LocalTime
        value={comparison.baselineScan.completedAt}
        preset="shortDateTime"
        className="whitespace-nowrap tabular-nums"
      />
      <span className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <MoveRight
          className="size-4 shrink-0 text-[var(--accent)]/80 sm:size-5"
          aria-hidden="true"
        />
        <span className="sr-only">Current scan</span>
        <LocalTime
          value={comparison.currentScan.completedAt}
          preset="shortDateTimeWithZone"
          className="whitespace-nowrap tabular-nums"
        />
      </span>
      {comparison.baselineMode === "pinned" ? (
        <Badge variant="outline">Pinned</Badge>
      ) : null}
    </div>
  )
}

function ComparisonHeader({
  comparison,
  headingId,
  variant,
}: {
  comparison: TimelineComparison
  headingId: string
  variant: "summary" | "target"
}) {
  if (variant === "target") {
    return (
      <CardHeader className="flex min-h-12 items-center border-b border-border/45 bg-card px-4 py-3 sm:px-5">
        <ComparisonFlow
          comparison={comparison}
          headingId={headingId}
          className="md:ml-auto md:justify-end"
        />
      </CardHeader>
    )
  }

  const targetLabel = formatTargetForDisplay(comparison.currentScan.target)

  return (
    <CardHeader className="flex flex-col gap-3 border-b border-border/60 bg-card px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-10">
      <div className="flex min-w-0 items-center gap-3 md:w-[min(18rem,28vw)] md:shrink-0">
        <ChangeTargetIcon faviconUrl={comparison.currentScan.faviconUrl} />
        <div className="min-w-0">
          <CardTitle>
            <h3 id={headingId}>
              <Link
                href={targetProfileHref(comparison)}
                className="block truncate font-mono text-lg font-semibold hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {targetLabel}
              </Link>
            </h3>
          </CardTitle>
        </div>
      </div>
      <ComparisonFlow comparison={comparison} className="md:ml-auto md:justify-end" />
    </CardHeader>
  )
}

function ComparisonCard({
  comparison,
  headingId,
  props,
}: {
  comparison: TimelineComparison
  headingId: string
  props: ChangeComparisonTimelineProps
}) {
  const visibleItems = comparison.items
  const matchingCount = "matching" in comparison.counts
    ? comparison.counts.matching
    : comparison.counts.total

  return (
    <Card className="gap-0 overflow-visible py-0">
      <ComparisonHeader comparison={comparison} headingId={headingId} variant={props.variant} />

      {visibleItems.length > 0 ? (
        <CardContent className={cn("divide-y divide-border/35 px-0", props.variant === "target" && "overflow-hidden rounded-b-xl")}>
          {visibleItems.map((item) => (
            <ChangeRow
              key={item.id}
              item={item}
              comparison={comparison}
              action={props.variant === "summary"
                ? { type: "button", onSelect: props.onSelect }
                : {
                    type: "link",
                    href: targetChangeItemHref({
                      basePath: props.basePath,
                      category: props.category,
                      comparisonId: comparison.id,
                      itemId: item.id,
                    }),
                  }}
            />
          ))}
        </CardContent>
      ) : (
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          No changes detected
        </CardContent>
      )}

      {props.variant === "summary" ? (
        <CardFooter className="justify-start border-border/35 bg-transparent px-5 py-3">
          <Button asChild variant="outline">
            <Link href={targetComparisonHref(comparison, props.category)}>
              View all {matchingCount}
              {props.category ? " matching" : ""}
              {matchingCount === 1 ? " change" : " changes"}
            </Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

export function ChangeComparisonTimeline(props: ChangeComparisonTimelineProps) {
  const { timeZone } = useTimeZone()
  const comparisonDays = groupComparisonsByDay(props.comparisons, timeZone)

  return (
    <div className="flex flex-col gap-8">
      {comparisonDays.map((day) => (
        <section
          key={day.key}
          aria-labelledby={`change-day-${day.key}`}
          className="grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-5"
        >
          <h2
            id={`change-day-${day.key}`}
            className={cn(
              "font-heading text-lg font-semibold leading-6 text-foreground md:sticky md:z-10 md:self-start md:py-3 md:backdrop-blur",
              props.variant === "target"
                ? "md:top-14 md:bg-card/95 md:supports-[backdrop-filter]:bg-card/85"
                : "md:top-[4.75rem] md:bg-background/95 md:supports-[backdrop-filter]:bg-background/85",
            )}
          >
            <LocalTime value={day.headingValue} preset="longDate" />
          </h2>
          <div className="relative flex flex-col gap-4 md:pl-6">
            <Separator orientation="vertical" className="absolute left-0 top-0 hidden h-full bg-border/60 md:block" />
            <span
              aria-hidden="true"
              className="absolute -left-[0.3rem] top-4 hidden size-2.5 rounded-full border-2 border-[var(--accent)] bg-background md:block"
            />
            {day.comparisons.map((comparison) => {
              const sectionId = `comparison-${comparison.id}`
              const headingId = `comparison-heading-${comparison.id}`
              const selected = props.variant === "target"
                && props.selectedComparisonId === comparison.id
                && !props.selectedItemId

              return (
                <SelectedComparisonSection
                  key={comparison.id}
                  id={sectionId}
                  labelledBy={headingId}
                  selected={selected}
                >
                  <ComparisonCard comparison={comparison} headingId={headingId} props={props} />
                </SelectedComparisonSection>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
