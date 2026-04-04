"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Globe, Clock, Layers, ChevronDown, ChevronRight, History } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { resolveFaviconPreviewSrc } from "@/lib/favicon"
import { TargetsTechnologiesCell } from "./targets-technologies-cell"
import type { TargetsRow } from "./types"
import { TARGETS_LATEST_SCAN_LINK_LABEL } from "./types"

interface TargetHistoryItem {
  scanId: string
  status: "pending" | "queued" | "running" | "processing" | "completed" | "failed" | "cancelled"
  title: string
  technologies: string[]
  submittedAt: string
  completedAt: string | null
}

interface TargetsSurfaceProps {
  rows: TargetsRow[]
}

function getTargetHistoryStatusLabel(status: TargetHistoryItem["status"]) {
  switch (status) {
    case "pending":
    case "queued":
      return "Queued"
    case "running":
    case "processing":
      return "Running"
    case "completed":
      return "Completed"
    case "failed":
      return "Failed"
    case "cancelled":
      return "Cancelled"
  }
}

function TargetHistoryStatusBadge({ status }: { status: TargetHistoryItem["status"] }) {
  const statusColors: Record<TargetHistoryItem["status"], string> = {
    pending: "bg-[var(--surface-light)]/50 text-[var(--text-dim)]",
    queued: "bg-[var(--surface-light)]/50 text-[var(--text-dim)]",
    running: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    processing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-400 border-red-500/30",
    cancelled: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  }

  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 border-[var(--gray-border)] ${statusColors[status]}`}
    >
      {getTargetHistoryStatusLabel(status)}
    </Badge>
  )
}

function TargetHistoryRow({ item }: { item: TargetHistoryItem }) {
  const timestamp = item.completedAt ?? item.submittedAt

  return (
    <TableRow className="border-[var(--gray-border)]/30 bg-[var(--surface-dark)]/30 hover:bg-[var(--surface-mid)]/30">
      <TableCell>
        <TargetHistoryStatusBadge status={item.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <History className="size-3 text-[var(--text-dim)]" />
          <span className="text-xs text-[var(--text-dim)] truncate max-w-[200px]">
            {item.title || "No title recorded"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
          <Clock className="size-3 shrink-0" />
          <span>{new Date(timestamp).toLocaleDateString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-6 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
        >
          <Link href={`/scans/${item.scanId}`}>
            View
            <ExternalLink className="size-3 ml-1" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function useTargetHistory(row: TargetsRow) {
  const [isOpen, setIsOpen] = useState(false)
  const [history, setHistory] = useState<TargetHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)

  const toggleHistory = async () => {
    if (hasLoadedHistory) {
      setIsOpen((previous) => !previous)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/v1/targets/${row.canonicalTargetId}/history?limit=5&excludeScanId=${row.latestScan.scanId}`,
      )

      if (response.ok) {
        const data = await response.json()
        setHistory(data.items)
        setIsOpen(true)
        setHasLoadedHistory(true)
      }
    } catch (error) {
      console.error("Failed to load target history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    history,
    isLoading,
    isOpen,
    hasLoadedHistory,
    setIsOpen,
    toggleHistory,
  }
}

function ExpandableTargetsRow({ row }: { row: TargetsRow }) {
  const { history, isLoading, isOpen, hasLoadedHistory, setIsOpen, toggleHistory } = useTargetHistory(row)
  const [desktopFaviconHidden, setDesktopFaviconHidden] = useState(false)
  const faviconPreviewSrc = desktopFaviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest("a") || target.closest("button")) {
      return
    }
    void toggleHistory()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      void toggleHistory()
    }
  }

  return (
    <>
      <TableRow
        className="border-[var(--gray-border)]/50 hover:bg-[var(--surface-mid)]/50 cursor-pointer"
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-label={`Expand history for ${row.target}`}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-xs"
               className="size-6 text-[var(--text-dim)] hover:text-[var(--accent)]"
               disabled={isLoading}
               onClick={(e) => {
                 e.stopPropagation()
                 void toggleHistory()
               }}
               aria-label={isOpen ? "Collapse history" : "Expand history"}
             >
              {isLoading ? (
                <div className="size-3 border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
              ) : isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
            {faviconPreviewSrc ? (
              <div className="size-4 shrink-0 rounded overflow-hidden flex items-center justify-center bg-[var(--surface-mid)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-4 object-contain"
                  onError={() => setDesktopFaviconHidden(true)}
                />
              </div>
            ) : (
              <Globe className="size-4 text-[var(--accent)] shrink-0" />
            )}
            <span className="font-mono text-sm truncate max-w-[140px] text-[var(--foreground)]">
              {row.target}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-[var(--text-dim)] line-clamp-1">
            {row.title}
          </span>
        </TableCell>
        <TableCell>
          <TargetsTechnologiesCell technologies={row.technologies} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
            <Clock className="size-3.5 shrink-0" />
            <span>{row.lastScannedAt.label}</span>
          </div>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
          >
            <Link href={row.latestScan.href} aria-label={row.latestScan.ariaLabel}>
              {TARGETS_LATEST_SCAN_LINK_LABEL}
              <ExternalLink className="size-3 ml-1" />
            </Link>
          </Button>
        </TableCell>
      </TableRow>
      {isOpen && (isLoading || hasLoadedHistory) && (
        <TableRow className="border-0">
          <TableCell colSpan={5} className="p-0">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
              <CollapsibleContent>
                <div className="bg-[var(--surface-dark)]/20 border-y border-[var(--gray-border)]/30">
                  {history.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[var(--gray-border)]/30 hover:bg-transparent">
                          <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70 pl-12">
                            Status
                          </TableHead>
                          <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                            Target history
                          </TableHead>
                          <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                            Ran at
                          </TableHead>
                          <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
                            Action
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item) => (
                          <TargetHistoryRow key={item.scanId} item={item} />
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="px-12 py-4 text-sm text-[var(--text-dim)]">
                      No previous runs for this target yet.
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function MobileTargetHistory({ history }: { history: TargetHistoryItem[] }) {
  if (history.length === 0) {
    return <div className="text-xs text-[var(--text-dim)]">No previous runs for this target yet.</div>
  }

  return (
    <div className="space-y-2">
      {history.map((item) => {
        const timestamp = item.completedAt ?? item.submittedAt

        return (
          <div
            key={item.scanId}
            className="rounded-md border border-[var(--gray-border)]/50 bg-[var(--surface-dark)]/30 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <TargetHistoryStatusBadge status={item.status} />
                  <span className="truncate text-xs text-[var(--text-dim)]">
                    {item.title || "No title recorded"}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
                  <Clock className="size-3 shrink-0" />
                  <span>{new Date(timestamp).toLocaleDateString()}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-6 px-2 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
              >
                <Link href={`/scans/${item.scanId}`}>
                  View
                  <ExternalLink className="size-3 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MobileTargetsCard({ row }: { row: TargetsRow }) {
  const { history, isLoading, isOpen, hasLoadedHistory, toggleHistory } = useTargetHistory(row)
  const [mobileFaviconHidden, setMobileFaviconHidden] = useState(false)
  const faviconPreviewSrc = mobileFaviconHidden ? null : resolveFaviconPreviewSrc(row.faviconUrl)

  return (
    <Card className="bg-[var(--surface-mid)] border-[var(--gray-border)]/50 hover:border-[var(--accent)]/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {faviconPreviewSrc ? (
              <div className="size-4 shrink-0 rounded overflow-hidden flex items-center justify-center bg-[var(--surface-mid)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization */}
                <img
                  src={faviconPreviewSrc}
                  alt=""
                  className="size-4 object-contain"
                  onError={() => setMobileFaviconHidden(true)}
                />
              </div>
            ) : (
              <Globe className="size-4 text-[var(--accent)] shrink-0" />
            )}
            <CardTitle className="text-sm font-mono truncate text-[var(--foreground)]">
              {row.target}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <span className="text-xs text-[var(--text-dim)]">{row.title}</span>
        </div>

        <div className="flex items-start gap-2">
          <Layers className="size-3.5 text-[var(--text-dim)] shrink-0 mt-0.5" />
          <TargetsTechnologiesCell technologies={row.technologies} />
        </div>

        <div className="flex items-center justify-between border-t border-[var(--gray-border)]/50 pt-2">
          <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
            <Clock className="size-3.5 shrink-0" />
            <span>{row.lastScannedAt.label}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleHistory()}
            className="h-7 px-2 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
            aria-expanded={isOpen}
            aria-label={isOpen ? `Hide history for ${row.target}` : `Show history for ${row.target}`}
          >
            {isLoading ? (
              <div className="size-3 border-2 border-[var(--text-dim)]/30 border-t-[var(--accent)] rounded-full animate-spin" />
            ) : isOpen ? (
              <ChevronDown className="size-3.5 mr-1" />
            ) : (
              <ChevronRight className="size-3.5 mr-1" />
            )}
            History
          </Button>
        </div>

        {isOpen && (isLoading || hasLoadedHistory) && (
          <div className="space-y-3 border-t border-[var(--gray-border)]/50 pt-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-dim)]/70">
              Target history
            </div>
            <MobileTargetHistory history={history} />
          </div>
        )}

        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
          >
            <Link href={row.latestScan.href} aria-label={row.latestScan.ariaLabel}>
              {TARGETS_LATEST_SCAN_LINK_LABEL}
              <ExternalLink className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function TargetsSurface({ rows }: TargetsSurfaceProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--gray-border)] hover:bg-transparent">
              <TableHead className="w-[200px] text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Target
              </TableHead>
              <TableHead className="w-[250px] text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Title
              </TableHead>
              <TableHead className="text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Technologies
              </TableHead>
              <TableHead className="w-[180px] text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Last scanned at
              </TableHead>
              <TableHead className="w-[120px] text-xs font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Latest scan
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ExpandableTargetsRow key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} row={row} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <MobileTargetsCard key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} row={row} />
        ))}
      </div>
    </>
  )
}
