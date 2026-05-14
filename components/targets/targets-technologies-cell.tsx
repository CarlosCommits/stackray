"use client"

import { Badge } from "@/components/ui/badge"

interface TargetsTechnologiesCellProps {
  technologies: string[]
  maxVisible?: number
}

export function TargetsTechnologiesCell({
  technologies,
  maxVisible = 3,
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
    <div className="flex flex-wrap items-center gap-1">
      {visibleItems.map((tech) => (
        <Badge
          key={tech}
          variant="outline"
          className="text-[9px] px-1.5 py-0 bg-[var(--surface-light)]/50 border-[var(--gray-border)]/50 text-[var(--foreground)]"
        >
          {tech}
        </Badge>
      ))}
      {hiddenCount > 0 && (
        <span className="text-[9px] text-[var(--text-dim)]">
          +{hiddenCount} more
        </span>
      )}
    </div>
  )
}
