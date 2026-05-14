"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, User, Layers, Globe, ArrowUpDown } from "lucide-react"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import type { RunsRow } from "./types"
import { getRunsStatusLabel } from "./types"

type SortOrder = "newest" | "oldest"

interface RunsSurfaceProps {
  rows: RunsRow[]
  sortOrder: SortOrder
  onToggleSortOrder: () => void
  isLoading?: boolean
}

function SourceBadge({ source }: { source: RunsRow["source"] }) {
  const sourceColors: Record<string, string> = {
    ui: "bg-[var(--surface-light)]/50 text-[var(--foreground)]",
    api: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    cli: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    system: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs px-2 py-0 border-[var(--gray-border)] ${
        sourceColors[source.value] || "text-[var(--text-dim)]"
      }`}
    >
      {source.label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: RunsRow["status"] }) {
  const statusColors: Record<string, string> = {
    queued: "bg-[var(--surface-light)]/50 text-[var(--text-dim)]",
    running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    cancelled: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  }

  return (
    <Badge
      variant="outline"
      className={`text-xs px-2 py-0 border-[var(--gray-border)] ${
        statusColors[status.value] || "text-[var(--text-dim)]"
      }`}
    >
      {getRunsStatusLabel(status.value)}
    </Badge>
  )
}

function TargetUrlsCell({ row }: { row: RunsRow }) {
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)
  const displayTarget = row.targetUrls[0] ? formatTargetForDisplay(row.targetUrls[0]) : "—"

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {faviconPreviewSrc ? (
          <div className="size-5 shrink-0 rounded overflow-hidden flex items-center justify-center bg-[var(--surface-mid)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
            <img
              src={faviconPreviewSrc}
              alt=""
              className="size-4 object-contain"
              onError={() => setFaviconHidden(true)}
            />
          </div>
        ) : (
          <Globe className="size-4 text-[var(--accent)] shrink-0" />
        )}
        <span className="text-sm font-mono text-[var(--foreground)] truncate max-w-[200px]">
           {displayTarget}
        </span>
      </div>
      {row.targetUrls.length > 1 && (
        <div className="flex items-center gap-1 pl-6">
          <span className="text-xs text-[var(--text-dim)]">
            +{row.targetUrls.length - 1} more
          </span>
        </div>
      )}
      {row.hiddenTargetCount > 0 && (
        <div className="flex items-center gap-1 pl-6">
          <span className="text-xs text-[var(--text-dim)]/60">
            +{row.hiddenTargetCount} hidden
          </span>
        </div>
      )}
    </div>
  )
}

function TechnologiesCell({ technologies }: { technologies: RunsRow["topTechnologies"] }) {
  if (technologies.totalCount === 0) {
    return <span className="text-sm text-[var(--text-dim)]">None</span>
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Layers className="size-4 text-[var(--text-dim)] shrink-0" />
      {technologies.visibleItems.map((tech) => (
        <Badge
          key={tech}
          variant="secondary"
          className="text-xs px-2 py-0 bg-[var(--surface-light)]/50"
        >
          {tech}
        </Badge>
      ))}
      {technologies.truncated && (
        <span className="text-xs text-[var(--text-dim)]">
          {technologies.overflowLabel}
        </span>
      )}
    </div>
  )
}

function DesktopTableRow({ row, navigate }: { row: RunsRow; navigate: (href: string) => void }) {
  const openScanFromRow = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("a") || target.closest("button")) {
      return
    }
    navigate(row.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      navigate(row.href)
    }
  }

  return (
    <TableRow
      key={row.scanId}
      className="border-[var(--gray-border)]/50 hover:border-amber-400/50 hover:bg-[var(--surface-mid)]/50 cursor-pointer group"
      onClick={openScanFromRow}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View scan details for ${row.scanId}`}
    >
      <TableCell>
        <div className="flex items-center gap-2 text-sm font-mono text-[var(--text-dim)]">
          <Clock className="size-4 shrink-0" />
          <span>{row.submittedAt.label}</span>
        </div>
      </TableCell>
      <TableCell>
        <TargetUrlsCell row={row} />
      </TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
      </TableCell>
      <TableCell>
        <SourceBadge source={row.source} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-sm font-mono text-[var(--text-dim)]">
          <User className="size-4 shrink-0" />
          <span className="truncate max-w-[120px]">{row.createdBy.label}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm font-mono text-[var(--foreground)]">
          {row.duration.label}
        </span>
      </TableCell>
      <TableCell>
        <TechnologiesCell technologies={row.topTechnologies} />
      </TableCell>
    </TableRow>
  )
}

function MobileRunCard({ row, navigate }: { row: RunsRow; navigate: (href: string) => void }) {
  const [faviconHidden, setFaviconHidden] = useState(false)
  const faviconPreviewSrc = faviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)
  const displayTarget = row.targetUrls[0] ? formatTargetForDisplay(row.targetUrls[0]) : "—"

  const openScanFromCard = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("a") || target.closest("button")) {
      return
    }
    navigate(row.href)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      navigate(row.href)
    }
  }

  return (
    <Card
      key={row.scanId}
      className="bg-[var(--surface-mid)] border-[var(--gray-border)]/50 hover:border-[var(--accent)]/40 transition-colors cursor-pointer group"
      onClick={openScanFromCard}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View scan details for ${row.scanId}`}
    >
      <CardContent className="p-4">
        {/* Row 1: Submitted at and Status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-mono text-[var(--text-dim)]">
            <Clock className="size-4 shrink-0" />
            <span>{row.submittedAt.label}</span>
          </div>
          <StatusBadge status={row.status} />
        </div>

        {/* Row 2: Source and Created by */}
        <div className="flex items-center gap-3 mb-4">
          <SourceBadge source={row.source} />
          <div className="flex items-center gap-2 text-sm font-mono text-[var(--text-dim)] ml-auto">
            <User className="size-4 shrink-0" />
            <span className="truncate max-w-[100px]">{row.createdBy.label}</span>
          </div>
        </div>

        {/* Row 3: Target with favicon */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            {faviconPreviewSrc ? (
              <div className="size-6 shrink-0 rounded overflow-hidden flex items-center justify-center bg-[var(--surface-mid)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-5 object-contain"
                  onError={() => setFaviconHidden(true)}
                />
              </div>
            ) : (
              <Globe className="size-5 text-[var(--accent)] shrink-0" />
            )}
            <span className="text-sm font-mono text-[var(--foreground)] truncate">
              {displayTarget}
            </span>
          </div>
          {row.targetUrls.length > 1 && (
            <div className="text-sm text-[var(--text-dim)] pl-7">
              +{row.targetUrls.length - 1} more
            </div>
          )}
        </div>

        {/* Row 4: Duration */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="font-mono text-[var(--text-dim)]">Duration:</span>
          <span className="font-mono text-[var(--foreground)]">
            {row.duration.label}
          </span>
        </div>

        {/* Row 5: Technologies */}
        {row.topTechnologies.totalCount > 0 && (
          <div className="flex items-start gap-2 mb-4">
            <Layers className="size-4 text-[var(--text-dim)] shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {row.topTechnologies.visibleItems.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="text-xs px-2 py-0 bg-[var(--surface-light)]/50"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RunsSurface({ rows, sortOrder, onToggleSortOrder, isLoading }: RunsSurfaceProps) {
  const { push } = useRouter()
  const navigate = (href: string) => push(href)

  if (rows.length === 0 && !isLoading) {
    return null
  }

  const placeholderCount = isLoading ? 5 : 0
  const placeholderRows = placeholderCount > 0 ? Array.from({ length: placeholderCount }, (_, i) => i) : []

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--gray-border)] hover:bg-transparent">
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[180px]">
                <button
                  type="button"
                  onClick={onToggleSortOrder}
                  className="flex cursor-pointer items-center gap-1.5 hover:text-[var(--foreground)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded"
                  aria-label={`Sort by submitted at, currently ${sortOrder === "newest" ? "newest first" : "oldest first"}`}
                >
                  Submitted at
                  <ArrowUpDown className="size-3 shrink-0" />
                </button>
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[240px]">
                Targets
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[120px]">
                Status
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[80px]">
                Source
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[160px]">
                Created by
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)] w-[100px]">
                Duration
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Top technologies
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <DesktopTableRow key={row.scanId} row={row} navigate={navigate} />
            ))}
            {placeholderRows.map((placeholderRow) => (
              <TableRow key={`desktop-placeholder-${placeholderRow}`} className="border-[var(--gray-border)]/50">
                <TableCell>
                  <div className="h-4 w-24 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-40 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-20 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-16 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-28 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-16 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-32 bg-[var(--surface-light)] rounded animate-pulse" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <MobileRunCard key={row.scanId} row={row} navigate={navigate} />
        ))}
        {placeholderRows.map((placeholderRow) => (
          <Card
            key={`mobile-placeholder-${placeholderRow}`}
            className="bg-[var(--surface-mid)] border-[var(--gray-border)]/50"
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="h-4 w-28 bg-[var(--surface-light)] rounded animate-pulse" />
                <div className="h-5 w-20 bg-[var(--surface-light)] rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-16 bg-[var(--surface-light)] rounded animate-pulse" />
                <div className="h-4 w-24 bg-[var(--surface-light)] rounded animate-pulse ml-auto" />
              </div>
              <div className="h-5 w-40 bg-[var(--surface-light)] rounded animate-pulse" />
              <div className="h-4 w-24 bg-[var(--surface-light)] rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-5 w-20 bg-[var(--surface-light)] rounded animate-pulse" />
                <div className="h-5 w-24 bg-[var(--surface-light)] rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
