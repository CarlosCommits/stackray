"use client"

import { useMemo, useState } from "react"
import type * as React from "react"
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
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { TechnologySection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import { compactPanelClass, insetHeaderDividerClass, insetPanelClass, insetRowDividerClass } from "./shared"

const technologyBucketPresentation: Record<
  TechnologySection["buckets"][number]["id"],
  { icon: React.ElementType; accentClassName: string; surfaceClassName: string; borderClassName: string }
> = {
  platform: {
    icon: Layers,
    accentClassName: "text-[var(--accent)]",
    surfaceClassName: "bg-[var(--accent)]/12",
    borderClassName: "border-[var(--accent)]/20",
  },
  framework: {
    icon: Network,
    accentClassName: "text-sky-300",
    surfaceClassName: "bg-sky-400/10",
    borderClassName: "border-sky-400/18",
  },
  infrastructure: {
    icon: Server,
    accentClassName: "text-emerald-300",
    surfaceClassName: "bg-emerald-400/10",
    borderClassName: "border-emerald-400/18",
  },
  business: {
    icon: Briefcase,
    accentClassName: "text-amber-300",
    surfaceClassName: "bg-amber-400/10",
    borderClassName: "border-amber-400/18",
  },
  security: {
    icon: Shield,
    accentClassName: "text-red-300",
    surfaceClassName: "bg-red-400/10",
    borderClassName: "border-red-400/18",
  },
  ecosystem: {
    icon: Fingerprint,
    accentClassName: "text-purple-300",
    surfaceClassName: "bg-purple-400/10",
    borderClassName: "border-purple-400/18",
  },
  other: {
    icon: Boxes,
    accentClassName: "text-[var(--muted-foreground)]",
    surfaceClassName: "bg-[var(--surface-mid)]/45",
    borderClassName: "border-[var(--gray-border)]/18",
  },
}

const cpeTechnologyPresentation = {
  icon: Cpu,
  accentClassName: "text-cyan-300",
  surfaceClassName: "bg-cyan-400/10",
  borderClassName: "border-cyan-400/18",
} satisfies { icon: React.ElementType; accentClassName: string; surfaceClassName: string; borderClassName: string }

type TechnologyTableRow =
  | {
      id: string
      category: string
      categoryId: TechnologySection["buckets"][number]["id"]
      name: string
      version: string | null
      type: string
      sources: readonly string[]
      iconUrl: string | null
      inferred: boolean
      categories: readonly string[]
      description: string | null
      website: string | null
    }
  | {
      id: string
      category: string
      categoryId: "other"
      name: string
      version: string | null
      type: string
      sources: readonly string[]
      iconUrl: null
      inferred: boolean
      categories: readonly string[]
      description: string | null
      website: string | null
      cpe: string
    }

type TechnologyTableGroup = {
  category: string
  categoryId: TechnologySection["buckets"][number]["id"]
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

  const cpeRows = technology.cpeEntries.map((entry) => ({
    id: `cpe-${entry.cpe}`,
    category: "CPE",
    categoryId: "other" as const,
    name: entry.vendor && entry.product
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

function TechnologyIcon({ iconUrl }: { iconUrl: string | null }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/45 ring-1 ring-white/5">
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

function TechnologyBlockRow({ row }: { row: TechnologyTableRow }) {
  const [metadataOpen, setMetadataOpen] = useState(false)
  const [metadataAnchor, setMetadataAnchor] = useState<{ x: number; y: number } | null>(null)
  const sourceLabel = row.sources.map(formatTechnologySource).join(", ")

  return (
    <Popover open={metadataOpen} onOpenChange={setMetadataOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "grid w-full min-w-0 cursor-pointer grid-cols-1 items-start gap-1.5 py-2 text-left transition-colors hover:bg-[var(--surface-mid)]/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 active:bg-[var(--surface-mid)]/18 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,0.45fr)] sm:items-center sm:gap-3",
            insetRowDividerClass,
          )}
          aria-label={`${row.name} technology details`}
          onClick={(event) => {
            setMetadataAnchor({ x: event.clientX, y: event.clientY })
          }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <TechnologyIcon iconUrl={row.iconUrl} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-[var(--foreground)]">{row.name}</span>
                {row.version && (
                  <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{row.version}</span>
                )}
              </div>
              {"cpe" in row && (
                <code className="mt-1 block truncate font-mono text-xs text-[var(--muted-foreground)]" title={row.cpe}>
                  {row.cpe}
                </code>
              )}
            </div>
          </div>
          <span className="ml-[2.375rem] min-w-0 text-sm leading-5 text-[var(--muted-foreground)] sm:ml-0 sm:truncate sm:text-right">
            {row.type}
          </span>
        </button>
      </PopoverTrigger>
      {metadataAnchor && (
        <PopoverAnchor asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed size-px"
            style={{ left: metadataAnchor.x, top: metadataAnchor.y }}
          />
        </PopoverAnchor>
      )}
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="z-[80] w-80 gap-3 border border-[var(--gray-border)]/35 bg-[#10161d] p-3 shadow-[0_26px_70px_-26px_rgba(0,0,0,0.95)] ring-1 ring-white/8"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/45 ring-1 ring-white/5">
            {row.iconUrl ? (
              <span className="flex size-full items-center justify-center bg-[radial-gradient(circle,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.82)_58%,rgba(255,255,255,0.18)_100%)] p-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- remote Wappalyzer icons are rendered directly in hover cards */}
                <img
                  src={row.iconUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 object-contain"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </span>
            ) : (
              <Globe className="size-[22px] text-[var(--muted-foreground)]" aria-hidden="true" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-[var(--foreground)]">{row.name}</span>
              {row.version && (
                <span className="shrink-0 font-mono text-xs text-[var(--muted-foreground)]">{row.version}</span>
              )}
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
        <div className="grid gap-2 text-xs text-[var(--muted-foreground)]">
          <div className="flex items-start justify-between gap-3">
            <span>Source</span>
            <span className="text-right text-[var(--foreground)]">{sourceLabel || "Unknown"}</span>
          </div>
          {"cpe" in row && (
            <div className="flex items-start justify-between gap-3">
              <span>CPE</span>
              <code className="max-w-48 break-all text-right text-[var(--foreground)]">{row.cpe}</code>
            </div>
          )}
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
      </PopoverContent>
    </Popover>
  )
}

function TechnologyCategoryBlock({ group }: { group: TechnologyTableGroup }) {
  const presentation = group.category === "CPE" ? cpeTechnologyPresentation : technologyBucketPresentation[group.categoryId]
  const Icon = presentation.icon

  return (
    <section className={cn("mb-3 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border bg-[var(--surface-dark)]/36 align-top ring-1 ring-white/5", presentation.borderClassName)}>
      <div className={cn("flex items-center gap-3 px-3 py-2.5", insetHeaderDividerClass)}>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", presentation.surfaceClassName)}>
          <Icon className={cn("size-4", presentation.accentClassName)} />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{group.category}</h3>
          <Badge variant="outline" className="h-6 px-2 text-xs">
            {group.rows.length}
          </Badge>
          <span className="h-px min-w-6 flex-1 bg-[var(--gray-border)]/18" />
        </div>
      </div>
      <div className={cn("grid gap-x-8 px-3 py-2", group.rows.length > 5 && "lg:grid-cols-2")}>
        {group.rows.map((row) => (
          <TechnologyBlockRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  )
}

// Technologies Section
export function TechnologiesSection({ technology }: { technology: TechnologySection }) {
  const [query, setQuery] = useState("")
  const rows = useMemo(() => buildTechnologyTableRows(technology), [technology])
  const normalizedQuery = query.trim().toLowerCase()
  const visibleRows = normalizedQuery
    ? rows.filter((row) => {
        const searchable = [
          row.category,
          row.name,
          row.type,
          row.version,
          ...row.sources,
          "cpe" in row ? row.cpe : null,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()

        return searchable.includes(normalizedQuery)
      })
    : rows
  const visibleGroups = useMemo(() => groupTechnologyTableRows(visibleRows), [visibleRows])

  return (
    <section className={`${compactPanelClass} overflow-hidden`}>
      <div className="flex justify-start px-4 py-3 sm:px-5">
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Search technologies</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search technologies..."
            className="h-9 w-full rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-dark)]/80 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none ring-1 ring-white/5 transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--gray-border)]/55 focus:border-[var(--accent)]/60"
          />
        </label>
      </div>

      <div className="relative p-4 [column-gap:0.75rem] before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-[var(--gray-border)]/24 sm:p-5 sm:before:inset-x-5 xl:columns-2">
        {visibleGroups.map((group) => (
          <TechnologyCategoryBlock key={`${group.categoryId}-${group.category}`} group={group} />
        ))}
        {visibleRows.length === 0 && (
          <div className={cn(insetPanelClass, "px-4 py-8 text-center text-sm text-[var(--muted-foreground)]")}>
            No technologies match the current search.
          </div>
        )}
      </div>
    </section>
  )
}

// DNS & Network Section Component
