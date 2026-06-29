"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import * as React from "react"
import {
  Boxes,
  Briefcase,
  Cpu,
  ExternalLink as LinkIcon,
  Fingerprint,
  Globe,
  Layers,
  Network,
  Search,
  Server,
  Shield,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { TechnologySection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import { compactPanelClass, insetHeaderDividerClass, insetRowDividerClass } from "./shared"
import { TechnologyCardExport } from "./technology-card-export"

const technologyBucketPresentation: Record<
  TechnologySection["buckets"][number]["id"],
  {
    icon: React.ElementType
    accentClassName: string
    surfaceClassName: string
    borderClassName: string
    ringClassName: string
  }
> = {
  platform: {
    icon: Layers,
    accentClassName: "text-[var(--accent)]",
    surfaceClassName: "bg-[var(--accent)]/12",
    borderClassName: "border-[var(--accent)]/22",
    ringClassName: "ring-[var(--accent)]/35",
  },
  framework: {
    icon: Network,
    accentClassName: "text-sky-300",
    surfaceClassName: "bg-sky-400/10",
    borderClassName: "border-sky-400/22",
    ringClassName: "ring-sky-400/35",
  },
  infrastructure: {
    icon: Server,
    accentClassName: "text-emerald-300",
    surfaceClassName: "bg-emerald-400/10",
    borderClassName: "border-emerald-400/22",
    ringClassName: "ring-emerald-400/35",
  },
  business: {
    icon: Briefcase,
    accentClassName: "text-amber-300",
    surfaceClassName: "bg-amber-400/10",
    borderClassName: "border-amber-400/22",
    ringClassName: "ring-amber-400/35",
  },
  security: {
    icon: Shield,
    accentClassName: "text-red-300",
    surfaceClassName: "bg-red-400/10",
    borderClassName: "border-red-400/22",
    ringClassName: "ring-red-400/35",
  },
  ecosystem: {
    icon: Fingerprint,
    accentClassName: "text-purple-300",
    surfaceClassName: "bg-purple-400/10",
    borderClassName: "border-purple-400/22",
    ringClassName: "ring-purple-400/35",
  },
  other: {
    icon: Boxes,
    accentClassName: "text-[var(--muted-foreground)]",
    surfaceClassName: "bg-[var(--surface-mid)]/45",
    borderClassName: "border-[var(--gray-border)]/22",
    ringClassName: "ring-[var(--gray-border)]/35",
  },
}

const cpeTechnologyPresentation = {
  icon: Cpu,
  accentClassName: "text-cyan-300",
  surfaceClassName: "bg-cyan-400/10",
  borderClassName: "border-cyan-400/22",
  ringClassName: "ring-cyan-400/35",
} satisfies {
  icon: React.ElementType
  accentClassName: string
  surfaceClassName: string
  borderClassName: string
  ringClassName: string
}

type BucketId = TechnologySection["buckets"][number]["id"] | "cpe"

export type TechnologyTableRow = {
  id: string
  category: string
  categoryId: BucketId
  name: string
  version: string | null
  type: string
  sources: readonly string[]
  iconUrl: string | null
  inferred: boolean
  categories: readonly string[]
  description: string | null
  website: string | null
  cpe?: string
}

type TechnologyTableGroup = {
  key: string
  category: string
  categoryId: BucketId
  rows: TechnologyTableRow[]
}

function buildTechnologyTableRows(technology: TechnologySection): TechnologyTableRow[] {
  const technologyRows = technology.buckets.flatMap((bucket) =>
    bucket.items.map((tech) => ({
      id: `${bucket.id}-${tech.name}-${tech.version ?? "none"}`,
      category: bucket.label,
      categoryId: bucket.id,
      name: tech.name,
      version: tech.version,
      type: tech.primaryCategory ?? tech.categories[0] ?? "Technology",
      sources: tech.sources,
      iconUrl: tech.iconUrl,
      inferred: tech.inferred,
      categories: tech.categories,
      description: tech.description,
      website: tech.website,
    })),
  )

  const cpeRows: TechnologyTableRow[] = technology.cpeEntries.map((entry) => ({
    id: `cpe-${entry.cpe}`,
    category: "CPE",
    categoryId: "cpe",
    name:
      entry.vendor && entry.product
        ? `${entry.vendor} ${entry.product}`
        : entry.vendor || entry.product || "Unknown product",
    version: entry.version,
    type: "CPE",
    sources: ["cpe"],
    iconUrl: null,
    inferred: false,
    categories: ["CPE"],
    description: null,
    website: null,
    cpe: entry.cpe,
  }))

  return [...technologyRows, ...cpeRows]
}

function groupTechnologyTableRows(rows: readonly TechnologyTableRow[]): TechnologyTableGroup[] {
  const groups = new Map<string, TechnologyTableGroup>()

  for (const row of rows) {
    const key = `${row.categoryId}-${row.category}`
    const existing = groups.get(key)

    if (existing) {
      existing.rows.push(row)
      continue
    }

    groups.set(key, {
      key,
      category: row.category,
      categoryId: row.categoryId,
      rows: [row],
    })
  }

  return [...groups.values()]
}

function formatTechnologySource(source: string) {
  switch (source) {
    case "wappalyzer":
      return "Wappalyzer"
    case "wordpress":
      return "WordPress"
    case "cpe":
      return "CPE"
    case "derived":
      return "Derived"
    case "nuclei":
      return "Nuclei"
    default:
      return source
  }
}

function getGroupPresentation(group: TechnologyTableGroup) {
  return group.categoryId === "cpe"
    ? cpeTechnologyPresentation
    : technologyBucketPresentation[group.categoryId as Exclude<BucketId, "cpe">]
}

function TechnologyIcon({ iconUrl, className }: { iconUrl: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center overflow-hidden border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/45 ring-1 ring-white/5",
        className,
      )}
    >
      {iconUrl ? (
        <span className="flex size-full items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.82)_58%,rgba(255,255,255,0.18)_100%)] p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Wappalyzer icons are rendered directly in technology rows */}
          <img
            src={iconUrl}
            alt=""
            width={22}
            height={22}
            className="size-[22px] object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = "none"
            }}
          />
        </span>
      ) : (
        <Globe className="size-4 text-[var(--muted-foreground)]" aria-hidden="true" />
      )}
    </span>
  )
}

function TechnologyDetailBody({ row }: { row: TechnologyTableRow }) {
  const sourceLabel = row.sources.map(formatTechnologySource).join(", ")

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <TechnologyIcon
          iconUrl={row.iconUrl}
          className="size-11 rounded-md [&_img]:size-8"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-[var(--foreground)]">{row.name}</span>
            {row.version ? (
              <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">
                {row.version}
              </span>
            ) : null}
            {row.inferred ? (
              <Badge
                variant="outline"
                className="h-5 border-amber-400/30 px-1.5 text-[10px] text-amber-300"
              >
                Inferred
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">
              {row.category}
            </Badge>
            {row.categories.map((category) => (
              <Badge key={`${row.id}-${category}`} variant="outline" className="text-xs">
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm leading-6 text-[var(--muted-foreground)]">
        {row.description ?? "No Wappalyzer description available."}
      </p>
      <div className="flex flex-col gap-1.5 border-t border-[var(--gray-border)]/20 pt-3 text-xs text-[var(--muted-foreground)]">
        <p>
          <span>Source:</span>{" "}
          <span className="text-[var(--foreground)]">{sourceLabel || "Unknown"}</span>
        </p>
        {row.cpe ? (
          <p className="break-all">
            <span>CPE:</span>{" "}
            <code className="font-mono text-[var(--foreground)]">{row.cpe}</code>
          </p>
        ) : null}
      </div>
      {row.website ? (
        <a
          href={row.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
        >
          <LinkIcon className="size-3" />
          Official site
        </a>
      ) : null}
    </div>
  )
}

const TechnologyRowTrigger = React.forwardRef<
  HTMLButtonElement,
  { row: TechnologyTableRow; open: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function TechnologyRowTrigger({ row, open, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${row.name} technology details`}
      aria-expanded={open}
      className={cn(
        "group/row grid w-full min-w-0 cursor-pointer grid-cols-1 items-start gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-mid)]/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 active:bg-[var(--surface-mid)]/22 sm:grid-cols-[minmax(0,1fr)_minmax(0,5.5rem)] sm:items-center sm:gap-3 sm:overflow-hidden sm:px-3",
        insetRowDividerClass,
        "after:inset-x-2.5 sm:after:inset-x-3",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <TechnologyIcon iconUrl={row.iconUrl} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="break-words text-sm font-semibold leading-tight text-[var(--foreground)]">
              {row.name}
            </span>
            {row.version ? (
              <span className="shrink-0 font-mono text-xs leading-tight text-[var(--muted-foreground)]">
                {row.version}
              </span>
            ) : null}
          </div>
          {row.cpe ? (
            <code
              className="mt-0.5 block break-all font-mono text-[10px] text-[var(--muted-foreground)]/80"
              title={row.cpe}
            >
              {row.cpe}
            </code>
          ) : null}
        </div>
      </div>
      <span className="ml-[2.375rem] min-w-0 truncate text-xs leading-5 text-[var(--muted-foreground)] sm:ml-0 sm:text-right">
        {row.type}
      </span>
    </button>
  )
})

function TechnologyRow({
  row,
  isDesktop,
}: {
  row: TechnologyTableRow
  isDesktop: boolean
}) {
  const [open, setOpen] = useState(false)

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <TechnologyRowTrigger row={row} open={open} />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-[80] w-80 gap-0 border border-[var(--gray-border)]/35 bg-[#10161d] p-3 shadow-[0_26px_70px_-26px_rgba(0,0,0,0.95)] ring-1 ring-white/8"
        >
          <TechnologyDetailBody row={row} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <TechnologyRowTrigger row={row} open={open} />
      </DrawerTrigger>
      <DrawerContent className="border-[var(--gray-border)]/40 bg-[#10161d] ring-1 ring-white/8">
        <DrawerTitle className="sr-only">{row.name} technology details</DrawerTitle>
        <div className="overflow-y-auto px-4 pb-6 pt-3">
          <TechnologyDetailBody row={row} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function TechnologyCategoryCard({ group, isDesktop }: { group: TechnologyTableGroup; isDesktop: boolean }) {
  const presentation = getGroupPresentation(group)
  const Icon = presentation.icon

  return (
    <section
      className={cn(
        "mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border bg-[var(--background)]/80 bg-clip-padding align-top ring-1 ring-white/5",
        presentation.borderClassName,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5",
          insetHeaderDividerClass,
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md ring-1",
            presentation.ringClassName,
            presentation.surfaceClassName,
          )}
        >
          <Icon className={cn("size-4", presentation.accentClassName)} />
        </span>
        <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--foreground)]">
          {group.category}
        </h3>
        <Badge
          variant="outline"
          className="ml-auto h-6 shrink-0 border-[var(--gray-border)]/40 tabular-nums text-xs text-[var(--muted-foreground)]"
        >
          {group.rows.length}
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-x-4 py-1.5 xl:grid-cols-2">
        {group.rows.map((row) => (
          <TechnologyRow key={row.id} row={row} isDesktop={isDesktop} />
        ))}
      </div>
    </section>
  )
}

function subscribeToDesktop(callback: () => void, breakpoint: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {}
  }

  const query = window.matchMedia(breakpoint)
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}

function readDesktopSnapshot(breakpoint: string) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true
  }
  return window.matchMedia(breakpoint).matches
}

function useIsDesktop(breakpoint = "(min-width: 640px)") {
  return useSyncExternalStore(
    (callback) => subscribeToDesktop(callback, breakpoint),
    () => readDesktopSnapshot(breakpoint),
    () => true,
  )
}

// Technologies Section
export function TechnologiesSection({
  technology,
  target,
  screenshotUrl,
  demoMode = false,
}: {
  technology: TechnologySection
  target?: string
  screenshotUrl?: string | null
  demoMode?: boolean
}) {
  const [query, setQuery] = useState("")
  const isDesktop = useIsDesktop()

  const rows = useMemo(() => buildTechnologyTableRows(technology), [technology])

  const normalizedQuery = query.trim().toLowerCase()
  const visibleRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows
    }

    return rows.filter((row) => {
      const searchable = [
        row.category,
        row.name,
        row.type,
        row.version,
        ...row.sources,
        row.cpe ?? null,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return searchable.includes(normalizedQuery)
    })
  }, [rows, normalizedQuery])

  const visibleGroups = useMemo(() => groupTechnologyTableRows(visibleRows), [visibleRows])
  const totalCount = technology.totalCount

  return (
    <section className={`${compactPanelClass} overflow-hidden`}>
      {/* Header: count + search */}
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
          <span className="tabular-nums text-[var(--foreground)]">{totalCount}</span>
          {" "}
          technologies
        </p>
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search technologies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search technologies..."
              className="h-9 w-full rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-dark)]/80 pl-9 pr-9 text-base text-[var(--foreground)] outline-none ring-1 ring-white/5 transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/55 focus:border-[var(--accent)]/60 md:text-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-mid)]/40 hover:text-[var(--foreground)]"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>
          {rows.length > 0 ? (
            <TechnologyCardExport
              key={rows.map((row) => row.id).join("|")}
              rows={rows}
              target={target}
              screenshotUrl={screenshotUrl}
              demoMode={demoMode}
            />
          ) : null}
        </div>
      </div>

      {/* Cards */}
      <div className="relative border-t border-[var(--gray-border)]/24 p-4 [column-gap:0.75rem] sm:p-5 xl:columns-2">
        {visibleGroups.length > 0 ? (
          visibleGroups.map((group) => (
            <TechnologyCategoryCard
              key={group.key}
              group={group}
              isDesktop={isDesktop}
            />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Search className="size-5 text-[var(--muted-foreground)]/60" />
            <p className="text-sm text-[var(--muted-foreground)]">
              {normalizedQuery ? "No technologies match your search." : "No technologies detected."}
            </p>
            {normalizedQuery ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-1 text-xs text-[var(--accent)] hover:underline"
              >
                Clear search
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
