import Link from "next/link"

import { AnimatedMetricValue } from "@/components/dashboard/animated-metric-value"
import type { Stat } from "@/components/dashboard/types"
import { NAVIGATION_TONES, NAVIGATION_VISUALS, type NavigationToneKey } from "@/components/navigation-theme"
import { cn } from "@/lib/utils"

interface OverviewMetricsProps {
  stats: Stat[]
}

type MetricIconKey = Extract<NavigationToneKey, "active" | "runs" | "targets" | "technologies">
type SparklinePoint = [number, number]

const sparklineHeight = 54
const sparklineWidth = 160
const sparklineTop = 18
const sparklineBottom = 50
const sparklineLeadInX = 32
const sparklineDataStartX = 54
const sparklineValueClearanceY = 45
const flatSparklineY = sparklineBottom
const sparklineDomainPaddingRatio = 0.35

function getSparklineValues(stat: Stat) {
  if (stat.sparkline && stat.sparkline.length >= 2) {
    return stat.sparkline
  }

  const value = Number(stat.value) || 0
  return Array.from({ length: 7 }, () => value)
}

function getSparklineDomain(values: number[]) {
  let minimumValue = Number.POSITIVE_INFINITY
  let maximumValue = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (Number.isFinite(value)) {
      minimumValue = Math.min(minimumValue, value)
      maximumValue = Math.max(maximumValue, value)
    }
  }

  if (!Number.isFinite(minimumValue) || !Number.isFinite(maximumValue)) {
    return { max: 1, min: 0 }
  }

  const range = maximumValue - minimumValue

  if (range <= 0) {
    return {
      max: Math.max(1, maximumValue),
      min: 0,
    }
  }

  const minimumPadding = maximumValue >= 10 ? 1 : 0
  const padding = Math.max(range * sparklineDomainPaddingRatio, minimumPadding)

  return {
    max: maximumValue + padding,
    min: Math.max(0, minimumValue - padding),
  }
}

function normalizeSparklinePoints(values: number[], domain: { max: number; min: number }): SparklinePoint[] {
  if (values.length === 0) {
    return []
  }

  if (values.length === 1) {
    return [[sparklineWidth, flatSparklineY]]
  }

  const domainRange = domain.max - domain.min

  if (domainRange <= 0) {
    return values.map((_, index) => {
      const x = (index / (values.length - 1)) * sparklineWidth
      return [Number(x.toFixed(2)), flatSparklineY]
    })
  }

  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * sparklineWidth
    const numericValue = Number.isFinite(value) ? value : 0
    const clampedValue = Math.max(domain.min, Math.min(numericValue, domain.max))
    const y = sparklineBottom - ((clampedValue - domain.min) / domainRange) * (sparklineBottom - sparklineTop)

    return [Number(x.toFixed(2)), Number(y.toFixed(2))]
  })
}

function addMetricValueLeadInToSparkline(points: SparklinePoint[]): SparklinePoint[] {
  if (points.length === 0) {
    return []
  }

  const dataWidth = sparklineWidth - sparklineDataStartX
  const remappedPoints = points.map(([x, y]) => [
    Number((sparklineDataStartX + (x / sparklineWidth) * dataWidth).toFixed(2)),
    y,
  ] satisfies SparklinePoint)
  const [, firstDataY] = remappedPoints[0] ?? [sparklineDataStartX, flatSparklineY]
  const clearanceY = Math.max(firstDataY, sparklineValueClearanceY)

  return [
    [0, clearanceY],
    [sparklineLeadInX, clearanceY],
    [sparklineDataStartX, clearanceY],
    ...remappedPoints,
  ]
}

function buildSparklinePath(points: SparklinePoint[]) {
  if (points.length === 0) {
    return ""
  }

  const [startX, startY] = points[0]
  const segments = points.slice(1).map(([x, y], index) => {
    const [previousX, previousY] = points[index]
    const controlX = (previousX + x) / 2
    return `C ${controlX} ${previousY}, ${controlX} ${y}, ${x} ${y}`
  })

  return [`M ${startX} ${startY}`, ...segments].join(" ")
}

function getMetricIconKey(stat: Stat): MetricIconKey {
  return stat.icon ?? "runs"
}

function getMetricAriaLabel(stat: Stat) {
  return `${stat.label}: ${stat.value}`
}

function MetricIcon({ stat }: { stat: Stat }) {
  const iconKey = getMetricIconKey(stat)
  const visual = NAVIGATION_VISUALS[iconKey]
  const Icon = visual.icon

  return <Icon aria-hidden="true" className={cn("size-5", NAVIGATION_TONES[visual.tone].icon)} />
}

function MetricSparkline({ iconKey, stat }: { iconKey: MetricIconKey; stat: Stat }) {
  const visual = NAVIGATION_VISUALS[iconKey]
  const sparkline = NAVIGATION_TONES[visual.tone].sparkline
  const values = getSparklineValues(stat)
  const sparklineDomain = getSparklineDomain(values)
  const points = addMetricValueLeadInToSparkline(normalizeSparklinePoints(values, sparklineDomain))
  const path = buildSparklinePath(points)
  const [endX, endY] = points.at(-1) ?? [0, 0]
  const isFlat = values.every((value) => value === values[0])
  const endpointStyle = {
    backgroundColor: sparkline.stroke,
    filter: `drop-shadow(0 0 7px ${sparkline.glow}) drop-shadow(0 0 14px ${sparkline.glow})`,
    left: `${(endX / sparklineWidth) * 100}%`,
    top: `${(endY / sparklineHeight) * 100}%`,
  }

  return (
    <span
      aria-hidden="true"
      data-slot="dashboard-metric-sparkline"
      data-tone={visual.tone}
      data-trend={isFlat ? "flat" : "rising"}
      data-points={values.length}
      data-scale-min={Number(sparklineDomain.min.toFixed(2))}
      data-scale-max={Number(sparklineDomain.max.toFixed(2))}
      className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0 block"
    >
      <svg className="size-full overflow-visible" viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`} preserveAspectRatio="none">
        <path
          d={path}
          className="dashboard-sparkline-draw"
          fill="none"
          stroke={sparkline.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
          opacity="0.2"
          style={{ filter: `drop-shadow(0 0 8px ${sparkline.glow}) drop-shadow(0 0 18px ${sparkline.glow})` }}
        />
        <path
          d={path}
          className="dashboard-sparkline-draw"
          fill="none"
          stroke={sparkline.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.35"
          style={{ filter: `drop-shadow(0 0 6px ${sparkline.glow})` }}
        />
      </svg>
      <span
        data-slot="dashboard-metric-sparkline-endpoint"
        className="dashboard-sparkline-endpoint absolute size-1.5 rounded-full"
        style={endpointStyle}
      />
    </span>
  )
}

function MetricContent({ stat }: { stat: Stat }) {
  const iconKey = getMetricIconKey(stat)
  const visual = NAVIGATION_VISUALS[iconKey]

  return (
    <div className="flex min-h-20 items-center gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          data-slot="dashboard-metric-icon"
          data-metric-icon={iconKey}
          data-tone={visual.tone}
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[16px] ring-1 ring-inset shadow-[0_14px_30px_rgba(0,0,0,0.24)]",
            NAVIGATION_TONES[visual.tone].shell,
          )}
        >
          <MetricIcon stat={stat} />
        </span>
        <div data-slot="dashboard-metric-value-column" className="isolate relative min-h-14 min-w-0 flex-1">
          <p className="relative z-20 min-w-0 truncate text-[10px] font-heading uppercase tracking-[0.18em] text-[var(--text-dim)]">
            <span
              data-slot="dashboard-metric-label-text"
              className="block max-w-full truncate drop-shadow-[0_1px_8px_rgba(7,10,16,0.95)]"
            >
              {stat.label}
            </span>
          </p>
          <p className="relative z-20 mt-1 font-heading text-2xl font-semibold leading-none text-[var(--foreground)] tabular-nums drop-shadow-[0_1px_10px_rgba(7,10,16,0.92)]">
            <AnimatedMetricValue value={stat.value} />
          </p>
          <MetricSparkline iconKey={iconKey} stat={stat} />
        </div>
      </div>
    </div>
  )
}

function MetricItem({ stat }: { stat: Stat }) {
  const className = "block min-w-0 bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] transition-[background-color] hover:bg-[var(--surface-mid)]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"

  if (!stat.href) {
    return (
      <div className="min-w-0 bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)]">
        <MetricContent stat={stat} />
      </div>
    )
  }

  return (
    <Link href={stat.href} className={className} aria-label={getMetricAriaLabel(stat)}>
      <MetricContent stat={stat} />
    </Link>
  )
}

function MetricSeparator({ index, total }: { index: number; total: number }) {
  const hasNextMetric = index < total - 1
  const hasSmColumnDivider = hasNextMetric && index % 2 === 0

  if (!hasNextMetric) {
    return null
  }

  return (
    <>
      <span
        aria-hidden="true"
        data-slot="dashboard-metric-separator"
        className="pointer-events-none absolute right-4 bottom-0 left-4 h-px bg-[var(--gray-border)]/70 sm:hidden"
      />
      {hasSmColumnDivider ? (
        <span
          aria-hidden="true"
          data-slot="dashboard-metric-separator"
          className="pointer-events-none absolute top-4 right-0 bottom-4 hidden w-px bg-[var(--gray-border)]/70 sm:block xl:hidden"
        />
      ) : null}
      <span
        aria-hidden="true"
        data-slot="dashboard-metric-separator"
        className="pointer-events-none absolute top-4 right-0 bottom-4 hidden w-px bg-[var(--gray-border)]/70 xl:block"
      />
    </>
  )
}

export function OverviewMetrics({ stats }: OverviewMetricsProps) {
  return (
    <section
      aria-label="Dashboard metrics"
      className="col-span-12 overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] shadow-[0_18px_52px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <ul className="grid sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <li key={stat.label} className="relative min-w-0">
            <MetricItem stat={stat} />
            <MetricSeparator index={index} total={stats.length} />
          </li>
        ))}
      </ul>
    </section>
  )
}
