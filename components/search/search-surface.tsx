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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Globe, Clock, Layers } from "lucide-react"
import { SearchTechnologiesCell } from "./search-technologies-cell"
import type { SearchModeValue, SearchRow } from "./types"
import { SEARCH_LATEST_SCAN_LINK_LABEL, SEARCH_MODE_LABELS } from "./types"

interface SearchSurfaceProps {
  rows: SearchRow[]
  mode: SearchModeValue
}

export function SearchSurface({ rows, mode }: SearchSurfaceProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--gray-border)] hover:bg-transparent">
              <TableHead className="w-[200px] text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Target</TableHead>
              <TableHead className="w-[250px] text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Title</TableHead>
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Technologies</TableHead>
              <TableHead className="w-[180px] text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Last scanned at</TableHead>
              <TableHead className="w-[120px] text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)]">Latest scan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} className="border-[var(--gray-border)]/50 hover:bg-[var(--surface-mid)]/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-[var(--accent)] shrink-0" />
                    <span className="font-mono text-sm truncate max-w-[160px] text-[var(--foreground)]">
                      {row.target}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--text-dim)] line-clamp-1">
                      {row.title}
                    </span>
                    {mode === "snapshots" && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[var(--gray-border)] text-[var(--text-dim)]">
                        {SEARCH_MODE_LABELS.snapshots}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <SearchTechnologiesCell technologies={row.technologies} />
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
                      {SEARCH_LATEST_SCAN_LINK_LABEL}
                      <ExternalLink className="size-3 ml-1" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {rows.map((row) => (
          <Card key={`${row.canonicalTargetId}:${row.lastScannedAt.iso}:${row.title}`} className="bg-[var(--surface-mid)] border-[var(--gray-border)]/50 hover:border-[var(--accent)]/40 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-[var(--accent)] shrink-0" />
                  <CardTitle className="text-sm font-mono truncate text-[var(--foreground)]">
                    {row.target}
                  </CardTitle>
                </div>
                {mode === "snapshots" && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[var(--gray-border)] text-[var(--text-dim)]">
                    {SEARCH_MODE_LABELS.snapshots}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-xs text-[var(--text-dim)]">{row.title}</span>
              </div>

              <div className="flex items-start gap-2">
                <Layers className="size-3.5 text-[var(--text-dim)] shrink-0 mt-0.5" />
                <SearchTechnologiesCell technologies={row.technologies} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[var(--gray-border)]/50">
                <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--text-dim)]">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{row.lastScannedAt.label}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-7 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)]"
                >
                  <Link href={row.latestScan.href} aria-label={row.latestScan.ariaLabel}>
                    {SEARCH_LATEST_SCAN_LINK_LABEL}
                    <ExternalLink className="size-3 ml-1" />
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
