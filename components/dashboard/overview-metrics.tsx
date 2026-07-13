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

  return <Icon aria-hidden="true" className={cn("size-4 xl:size-5", NAVIGATION_TONES[visual.tone].icon)} />
}

function MetricSparkline({ iconKey, stat }: { iconKey: MetricIconKey; stat: Stat }) {
  const visual = NAVIGATION_VISUALS[iconKey]
  const sparkline = NAVIGATION_TONES[visual.tone].sparkline
  const values = getSparklineValues(stat)
  const sparklineDomain = getSparklineDomain(values)
  const points = normalizeSparklinePoints(values, sparklineDomain)
  const path = buildSparklinePath(points)
  const [endX, endY] = points.at(-1) ?? [0, 0]
  const isFlat = values.every((value) => value === values[0])
  const endpointStyle = {
    backgroundColor: sparkline.stroke,
    filter: `drop-shadow(0 0 4px ${sparkline.glow})`,
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
      className="pointer-events-none absolute inset-x-3 bottom-4 z-0 block h-6 xl:inset-x-4"
    >
      <svg className="size-full overflow-visible" viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`} preserveAspectRatio="none">
        <path
          d={path}
          className="dashboard-sparkline-draw"
          fill="none"
          stroke={sparkline.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
          opacity="0.14"
          style={{ filter: `drop-shadow(0 0 4px ${sparkline.glow})` }}
        />
        <path
          d={path}
          className="dashboard-sparkline-draw"
          fill="none"
          stroke={sparkline.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          vectorEffect="non-scaling-stroke"
          opacity="0.92"
          style={{ filter: `drop-shadow(0 0 4px ${sparkline.glow})` }}
        />
      </svg>
      <span
        data-slot="dashboard-metric-sparkline-endpoint"
        className="dashboard-sparkline-endpoint absolute size-1 rounded-full"
        style={endpointStyle}
      />
    </span>
  )
}

function MetricContent({ stat }: { stat: Stat }) {
  const iconKey = getMetricIconKey(stat)
  const visual = NAVIGATION_VISUALS[iconKey]

  return (
    <div
      data-slot="dashboard-metric-content"
      className="relative min-h-[88px] px-3 py-3 xl:min-h-20 xl:px-4"
    >
      <div className="relative z-10 flex min-w-0 items-start gap-2.5 xl:items-center xl:gap-3">
        <span
          aria-hidden="true"
          data-slot="dashboard-metric-icon"
          data-metric-icon={iconKey}
          data-tone={visual.tone}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-[0_10px_22px_rgba(0,0,0,0.18)] xl:size-10",
            NAVIGATION_TONES[visual.tone].shell,
          )}
        >
          <MetricIcon stat={stat} />
        </span>
        <div data-slot="dashboard-metric-value-column" className="min-w-0 flex-1">
          <p className="min-w-0 truncate font-heading text-[9px] uppercase tracking-[0.14em] text-[var(--text-dim)] xl:text-[10px] xl:tracking-[0.18em]">
            <span data-slot="dashboard-metric-label-text" className="block max-w-full truncate">
              {stat.label}
            </span>
          </p>
          <p className="mt-1 font-heading text-xl font-semibold leading-none text-[var(--foreground)] tabular-nums xl:text-2xl">
            <AnimatedMetricValue value={stat.value} />
          </p>
        </div>
      </div>
      <MetricSparkline iconKey={iconKey} stat={stat} />
    </div>
  )
}

function MetricItem({ stat }: { stat: Stat }) {
  const className = "group/metric block min-w-0 bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] transition-[background-color,transform] duration-200 hover:bg-[var(--surface-mid)]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] active:translate-y-px"

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

export function OverviewMetrics({ stats }: OverviewMetricsProps) {
  return (
    <section
      aria-label="Dashboard metrics"
      className="col-span-12 overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--gray-border)_82%,#60a5fa)] bg-[color-mix(in_srgb,var(--surface-dark)_92%,black)] shadow-[0_18px_52px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]"
    >
      <ul className="grid grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <li
            key={stat.label}
            className={cn(
              "relative min-w-0 border-[var(--gray-border)] xl:border-b-0",
              index < stats.length - 2 && "border-b",
              index < stats.length - 1 && index % 2 === 0 && "border-r",
              index < stats.length - 1 && "xl:border-r",
            )}
          >
            <MetricItem stat={stat} />
          </li>
        ))}
      </ul>
    </section>
  )
}
