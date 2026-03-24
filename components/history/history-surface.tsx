"use client"

import Link from "next/link"
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
import { Button } from "@/components/ui/button"
import { HistoryStatusBadge } from "./history-status-badge"
import { HistoryTechnologiesCell } from "./history-technologies-cell"
import type { HistoryRow } from "./types"
import {
  Clock,
  User,
  ChevronRight,
  Layers,
  Target,
} from "lucide-react"

interface HistorySurfaceProps {
  rows: HistoryRow[]
}

function SourceBadge({ source }: { source: HistoryRow["source"] }) {
  const sourceColors: Record<string, string> = {
    ui: "bg-[var(--surface-light)]/50 text-[var(--foreground)]",
    api: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    cli: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    system: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  }

  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1.5 py-0 border-[var(--gray-border)] ${
        sourceColors[source.value] || "text-[var(--text-dim)]"
      }`}
    >
      {source.label}
    </Badge>
  )
}

export function HistorySurface({ rows }: HistorySurfaceProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--gray-border)] hover:bg-transparent">
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[160px]">
                Submitted at
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[100px]">
                Target count
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[100px]">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[80px]">
                Source
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[120px]">
                Created by
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] w-[100px]">
                Duration
              </TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">
                Top technologies
              </TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.scanId}
                className="border-[var(--gray-border)]/50 hover:bg-[var(--surface-mid)]/50 group"
              >
                <TableCell>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-dim)]">
                    <Clock className="size-3 shrink-0" />
                    <span>{row.submittedAt.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Target className="size-3 text-[var(--accent)] shrink-0" />
                    <span className="text-[10px] font-mono text-[var(--foreground)]">
                      {row.targetCount.label}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <HistoryStatusBadge status={row.status.value} />
                </TableCell>
                <TableCell>
                  <SourceBadge source={row.source} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-dim)]">
                    <User className="size-3 shrink-0" />
                    <span className="truncate max-w-[100px]">{row.createdBy.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] font-mono text-[var(--foreground)]">
                    {row.duration.label}
                  </span>
                </TableCell>
                <TableCell>
                  <HistoryTechnologiesCell technologies={row.topTechnologies} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    asChild
                    className="text-[var(--text-dim)] group-hover:text-[var(--accent)] transition-colors"
                  >
                    <Link href={row.href} aria-label={`View details for scan ${row.scanId}`}>
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <Card
            key={row.scanId}
            className="bg-[var(--surface-mid)] border-[var(--gray-border)]/50 hover:border-[var(--accent)]/40 transition-colors group"
          >
            <CardContent className="p-3">
              {/* Row 1: Submitted at and Status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-dim)]">
                  <Clock className="size-3 shrink-0" />
                  <span>{row.submittedAt.label}</span>
                </div>
                <HistoryStatusBadge status={row.status.value} />
              </div>

              {/* Row 2: Target count, Source, Created by */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <Target className="size-3 text-[var(--accent)] shrink-0" />
                  <span className="text-[9px] font-mono text-[var(--foreground)]">
                    {row.targetCount.label}
                  </span>
                </div>
                <SourceBadge source={row.source} />
                <div className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-dim)] ml-auto">
                  <User className="size-3 shrink-0" />
                  <span className="truncate max-w-[80px]">{row.createdBy.label}</span>
                </div>
              </div>

              {/* Row 3: Duration */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-[9px] font-mono text-[var(--text-dim)]">Duration:</span>
                <span className="text-[9px] font-mono text-[var(--foreground)]">
                  {row.duration.label}
                </span>
              </div>

              {/* Row 4: Technologies */}
              {row.topTechnologies.totalCount > 0 && (
                <div className="flex items-start gap-2 mb-3">
                  <Layers className="size-3 text-[var(--text-dim)] shrink-0 mt-0.5" />
                  <HistoryTechnologiesCell technologies={row.topTechnologies} size="sm" />
                </div>
              )}

              {/* Row 5: View Details Link */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
                >
                  <Link href={row.href}>
                    View details
                    <ChevronRight className="size-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
