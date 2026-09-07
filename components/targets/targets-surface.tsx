"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Clock, Globe } from "lucide-react"

import { Card } from "@/components/ui/card"
import { LocalTime } from "@/components/ui/local-time"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { formatTargetForDisplay } from "@/lib/targets/display-target"
import { TargetsTechnologiesCell } from "./targets-technologies-cell"
import type { TargetsRow } from "./types"

export interface TargetHistoryItem {
  scanId: string
  status: "pending" | "queued" | "running" | "processing" | "completed" | "failed" | "cancelled"
  title: string
  technologies: string[]
  submittedAt: string
  completedAt: string | null
}

function TargetFavicon({ faviconUrl, className = "size-4" }: { faviconUrl: string | null; className?: string }) {
  const [hidden, setHidden] = useState(false)
  const src = hidden ? null : resolveFaviconPreviewSrc(faviconUrl)

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon previews use the shared proxy/fallback behavior
    <img src={src} alt="" className={`${className} object-contain`} onError={() => setHidden(true)} />
  ) : <Globe className={`${className} text-[var(--accent)]`} aria-hidden="true" />
}

function DesktopTargetRow({ row }: { row: TargetsRow }) {
  const href = `/targets/${row.canonicalTargetId}`
  const target = formatTargetForDisplay(row.target)

  return (
    <TableRow className="group h-10 cursor-pointer border-[var(--gray-border)]/35 hover:bg-[var(--surface-mid)]/55">
      <TableCell className="p-0">
        <Link href={href} className="flex h-10 min-w-0 items-center gap-2 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset">
          <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-mid)]"><TargetFavicon faviconUrl={row.faviconUrl} /></span>
          <span className="truncate font-mono text-sm text-foreground">{target}</span>
        </Link>
      </TableCell>
      <TableCell className="p-0">
        <Link href={href} className="flex h-10 min-w-0 items-center px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset">
          <span className="line-clamp-1 text-sm text-muted-foreground">{row.title}</span>
        </Link>
      </TableCell>
      <TableCell className="p-0">
        <Link href={href} className="flex h-10 min-w-0 items-center px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset">
          <TargetsTechnologiesCell technologies={row.technologies} maxVisible={1} wrap={false} />
        </Link>
      </TableCell>
      <TableCell className="p-0">
        <Link href={href} className="flex h-10 min-w-0 items-center gap-1.5 px-2 font-mono text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <LocalTime value={row.lastScannedAt.iso} preset="compactDateTimeWithZone" className="truncate" />
        </Link>
      </TableCell>
    </TableRow>
  )
}

function MobileTargetRow({ row }: { row: TargetsRow }) {
  const target = formatTargetForDisplay(row.target)

  return (
    <Card className="gap-0 py-0">
      <Link href={`/targets/${row.canonicalTargetId}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3">
        <span className="flex size-8 items-center justify-center overflow-hidden rounded-md bg-black/20"><TargetFavicon faviconUrl={row.faviconUrl} className="size-5" /></span>
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm font-semibold text-foreground">{target}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.title || "No title recorded"}</span>
          <LocalTime value={row.lastScannedAt.iso} preset="compactDate" className="mt-1 block font-mono text-[10px] text-muted-foreground" />
        </span>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden="true" />
      </Link>
    </Card>
  )
}

export function TargetsSurface({ rows }: { rows: TargetsRow[] }) {
  if (rows.length === 0) return null

  return (
    <>
      <div className="hidden lg:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="h-8 border-[var(--gray-border)]/70 hover:bg-transparent">
              <TableHead className="h-8 w-[190px] px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Target</TableHead>
              <TableHead className="h-8 w-[360px] px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
              <TableHead className="h-8 w-[240px] px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Technologies</TableHead>
              <TableHead className="h-8 w-[220px] px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Last scanned at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{rows.map((row) => <DesktopTargetRow key={row.canonicalTargetId} row={row} />)}</TableBody>
        </Table>
      </div>
      <div className="space-y-1.5 lg:hidden">{rows.map((row) => <MobileTargetRow key={row.canonicalTargetId} row={row} />)}</div>
    </>
  )
}
