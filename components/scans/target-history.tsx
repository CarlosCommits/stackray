"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { History, ArrowRight, Calendar, Layers } from "lucide-react"
import Link from "next/link"

interface TargetHistoryItem {
  scanId: string
  status: "completed" | "failed" | "cancelled"
  title: string
  technologies: string[]
  completedAt: string
}

interface TargetHistoryProps {
  target: string
  history: TargetHistoryItem[]
}

export function TargetHistory({ target, history }: TargetHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "border-green-500/40 text-green-400 bg-green-500/10"
      case "failed":
        return "border-red-500/40 text-red-400 bg-red-500/10"
      default:
        return "border-[var(--gray-border)] text-[var(--text-dim)]"
    }
  }

  return (
    <section className="scan-section">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[var(--accent)]/10">
            <History className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="scan-section-title">Target History</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Previous scans for {target}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-sm">
          {history.length} scans
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {history.map((item) => (
          <Card
            key={item.scanId}
            className="group scan-panel hover:border-[var(--accent)]/30 transition-all"
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span className="text-sm text-[var(--muted-foreground)]">{formatDate(item.completedAt)}</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-sm px-2 py-0.5 ${getStatusVariant(item.status)}`}
                >
                  {item.status}
                </Badge>
              </div>

              <p className="text-base font-medium text-[var(--foreground)] line-clamp-2 mb-4 min-h-[2.5rem]">
                {item.title}
              </p>

              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-[var(--muted-foreground)]" />
                <div className="flex flex-wrap gap-1.5">
                  {item.technologies.slice(0, 3).map((tech) => (
                    <Badge
                      key={tech}
                      variant="outline"
                      className="text-sm bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)] px-2 py-0.5"
                    >
                      {tech}
                    </Badge>
                  ))}
                  {item.technologies.length > 3 && (
                    <span className="text-sm text-[var(--muted-foreground)]">+{item.technologies.length - 3}</span>
                  )}
                </div>
              </div>

              <Link href={`/scans/${item.scanId}`} className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-sm font-medium border-[var(--gray-border)] text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 h-9"
                >
                  View Scan
                  <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}

        {history.length < 4 && (
          <Card className="bg-[var(--surface-dark)]/50 border-[var(--gray-border)]/10 border-dashed shadow-none">
            <CardContent className="flex items-center justify-center min-h-[200px]">
              <div className="text-center">
                <History className="w-8 h-8 text-[var(--muted-foreground)]/40 mx-auto mb-2" />
                <p className="text-sm text-[var(--muted-foreground)]/60">No additional history</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
