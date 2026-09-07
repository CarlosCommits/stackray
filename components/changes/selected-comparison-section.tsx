"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SelectedComparisonSection({
  id,
  labelledBy,
  selected,
  children,
}: {
  id: string
  labelledBy: string
  selected: boolean
  children: ReactNode
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const [highlighted, setHighlighted] = useState(selected)

  useEffect(() => {
    if (!selected) return

    const scrollFrame = window.requestAnimationFrame(() => {
      setHighlighted(true)
      sectionRef.current?.scrollIntoView({ block: "center" })
    })
    const highlightTimer = window.setTimeout(() => setHighlighted(false), 1_800)

    return () => {
      window.cancelAnimationFrame(scrollFrame)
      window.clearTimeout(highlightTimer)
    }
  }, [selected])

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby={labelledBy}
      data-highlighted={highlighted}
      className={cn(
        "scroll-mt-24 transition-[background-color,box-shadow] duration-500",
        "data-[highlighted=true]:bg-[var(--accent)]/5 data-[highlighted=true]:ring-1 data-[highlighted=true]:ring-inset data-[highlighted=true]:ring-[var(--accent)]/50",
      )}
    >
      {children}
    </section>
  )
}
