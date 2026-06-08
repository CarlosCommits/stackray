"use client"

import { Badge } from "@/components/ui/badge"

interface TargetsTechnologiesCellProps {
  technologies: string[]
  maxVisible?: number
  wrap?: boolean
  hiddenCountClassName?: string
}

export function TargetsTechnologiesCell({
  technologies,
  maxVisible = 3,
  wrap = true,
  hiddenCountClassName = "",
}: TargetsTechnologiesCellProps) {
  if (technologies.length === 0) {
    return (
      <span className="text-muted-foreground/40 text-xs">
        None
      </span>
    )
  }

  const visibleItems = technologies.slice(0, maxVisible)
  const hiddenCount = Math.max(technologies.length - visibleItems.length, 0)

  return (
    <div className={`flex items-center gap-1 ${wrap ? "flex-wrap" : "min-w-0 overflow-hidden"}`}>
      {visibleItems.map((tech) => (
        <Badge
          key={tech}
          variant="outline"
          className={`text-xs px-2 py-0 bg-[var(--surface-light)]/50 border-[var(--gray-border)]/50 text-[var(--foreground)] ${wrap ? "" : "max-w-[180px] truncate"}`}
        >
          {tech}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <span className={`shrink-0 text-xs text-[var(--text-dim)] ${hiddenCountClassName}`}>
          +{hiddenCount} more
        </span>
      )}
    </div>
  )
}
