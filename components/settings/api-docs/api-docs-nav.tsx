"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

export interface TocItem {
  id: string
  label: string
}

interface ApiDocsNavProps {
  items: TocItem[]
}

const SECTION_SCROLL_OFFSET_PX = 24
const PROGRAMMATIC_SCROLL_SETTLE_MS = 180

export function ApiDocsNav({ items }: ApiDocsNavProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "")
  const navRef = useRef<HTMLElement | null>(null)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const pendingScrollTargetRef = useRef<string | null>(null)
  const scrollSettleTimeoutRef = useRef<number | null>(null)

  const findScrollableAncestor = useCallback(() => {
    let current = navRef.current?.parentElement ?? null

    while (current) {
      const styles = window.getComputedStyle(current)
      const overflowY = styles.overflowY
      const overflow = styles.overflow
      const isScrollable =
        (overflowY === "auto" || overflowY === "scroll" || overflow === "auto" || overflow === "scroll") &&
        current.clientHeight > 0

      if (isScrollable) {
        return current
      }

      current = current.parentElement
    }

    return null
  }, [])

  const findScrollContainer = useCallback(() => {
    const container = document.querySelector('[data-app-scroll-container="true"]')
    if (container instanceof HTMLElement) {
      scrollContainerRef.current = container
      return container
    }

    const fallbackContainer = findScrollableAncestor()
    if (fallbackContainer) {
      scrollContainerRef.current = fallbackContainer
      return fallbackContainer
    }

    return null
  }, [findScrollableAncestor])

  const scrollToSection = useCallback((id: string) => {
    const container = scrollContainerRef.current ?? findScrollContainer()
    const element = document.getElementById(id)
    
    if (element && container) {
      const elementTop = element.getBoundingClientRect().top
      const containerTop = container.getBoundingClientRect().top
      const scrollTop = container.scrollTop
      const targetScrollTop = scrollTop + elementTop - containerTop - SECTION_SCROLL_OFFSET_PX
      
      container.scrollTo({
        top: targetScrollTop,
        behavior: "smooth"
      })

      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${id}`)
      }
    }
  }, [findScrollContainer])

  const clearProgrammaticScroll = useCallback(() => {
    pendingScrollTargetRef.current = null
    if (scrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(scrollSettleTimeoutRef.current)
      scrollSettleTimeoutRef.current = null
    }
  }, [])

  const updateActiveSection = useCallback(() => {
    const container = scrollContainerRef.current ?? findScrollContainer()
    if (!container) {
      return
    }

    const containerTop = container.getBoundingClientRect().top
    const anchorLine = SECTION_SCROLL_OFFSET_PX
    const sectionPositions = items
      .map((item) => {
        const element = document.getElementById(item.id)
        if (!element) {
          return null
        }

        return {
          id: item.id,
          top: element.getBoundingClientRect().top - containerTop,
        }
      })
      .filter((item): item is { id: string; top: number } => item !== null)

    if (sectionPositions.length === 0) {
      return
    }

    const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 8

    if (isNearBottom) {
      setActiveId(sectionPositions[sectionPositions.length - 1].id)
      return
    }

    const currentSection =
      [...sectionPositions].reverse().find((item) => item.top <= anchorLine)
      ?? sectionPositions[0]

    setActiveId(currentSection.id)
  }, [findScrollContainer, items])

  const scheduleProgrammaticScrollSettle = useCallback(() => {
    if (scrollSettleTimeoutRef.current !== null) {
      window.clearTimeout(scrollSettleTimeoutRef.current)
    }

    scrollSettleTimeoutRef.current = window.setTimeout(() => {
      clearProgrammaticScroll()
      updateActiveSection()
    }, PROGRAMMATIC_SCROLL_SETTLE_MS)
  }, [clearProgrammaticScroll, updateActiveSection])

  useEffect(() => {
    const container = findScrollContainer()
    if (!container) {
      const retry = window.setTimeout(() => updateActiveSection(), 100)
      return () => window.clearTimeout(retry)
    }

    const handleScroll = () => {
      if (pendingScrollTargetRef.current) {
        setActiveId(pendingScrollTargetRef.current)
        scheduleProgrammaticScrollSettle()
        return
      }

      updateActiveSection()
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleScroll)

    if (typeof window !== "undefined" && window.location.hash) {
      const id = window.location.hash.slice(1)
      requestAnimationFrame(() => {
        setActiveId(id)
        scrollToSection(id)
      })
    } else {
      requestAnimationFrame(() => updateActiveSection())
    }

    const handleHashChange = () => {
      const id = window.location.hash.slice(1)
      if (!id) {
        return
      }

      pendingScrollTargetRef.current = id
      setActiveId(id)
      requestAnimationFrame(() => scrollToSection(id))
      scheduleProgrammaticScrollSettle()
    }

    window.addEventListener("hashchange", handleHashChange)

    return () => {
      clearProgrammaticScroll()
      container.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleScroll)
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [clearProgrammaticScroll, findScrollContainer, scheduleProgrammaticScrollSettle, scrollToSection, updateActiveSection])

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault()
    pendingScrollTargetRef.current = id
    setActiveId(id)
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`)
    }
    requestAnimationFrame(() => scrollToSection(id))
    scheduleProgrammaticScrollSettle()
  }

  if (items.length === 0) {
    return null
  }

  return (
    <nav
      ref={navRef}
      className="hidden xl:block w-56 shrink-0"
      aria-label="API documentation navigation"
    >
      <div className="sticky top-[72px]">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-3 px-2">
          On this page
        </h2>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(event) => handleClick(event, item.id)}
                aria-current={activeId === item.id ? "location" : undefined}
                className={cn(
                  "block w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors duration-150",
                  activeId === item.id
                    ? "text-[var(--accent)] bg-[var(--accent)]/10 font-medium"
                    : "text-[var(--text-dim)] hover:text-[var(--foreground)] hover:bg-[var(--surface-mid)]"
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
