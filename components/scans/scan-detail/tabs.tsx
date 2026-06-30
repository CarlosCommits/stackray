"use client"

import { useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Fingerprint,
  Globe2,
  Info,
  Layers,
  Lock,
  MapPin,
  Network,
} from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type ScanDetailSectionTabItem = {
  value: string
  label: string
  content: React.ReactNode
}

const scanDetailSectionTabIcons: Record<string, React.ElementType> = {
  technologies: Layers,
  dnsInfrastructure: Network,
  ipIntelligence: MapPin,
  subdomains: Globe2,
  tlsCertificate: Lock,
  fingerprints: Fingerprint,
  domainInfo: FileText,
  rawEvidence: FileText,
  scanInfo: Info,
}

export function ScanDetailSectionTabs({ items }: { items: ScanDetailSectionTabItem[] }) {
  const defaultValue = items[0]?.value
  const [activeValue, setActiveValue] = useState<string>()
  const effectiveActiveValue =
    activeValue && items.some((item) => item.value === activeValue) ? activeValue : defaultValue
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const tabsRootRef = useRef<HTMLDivElement | null>(null)
  const [tabScrollState, setTabScrollState] = useState({ canScrollLeft: false, canScrollRight: false })

  useEffect(() => {
    const tabList = tabListRef.current

    if (!tabList) {
      return
    }

    const list = tabList

    function updateScrollState() {
      const maxScrollLeft = list.scrollWidth - list.clientWidth

      const nextState = {
        canScrollLeft: list.scrollLeft > 1,
        canScrollRight: list.scrollLeft < maxScrollLeft - 1,
      }

      setTabScrollState((current) => (
        current.canScrollLeft === nextState.canScrollLeft && current.canScrollRight === nextState.canScrollRight
          ? current
          : nextState
      ))
    }

    updateScrollState()
    list.addEventListener("scroll", updateScrollState, { passive: true })
    window.addEventListener("resize", updateScrollState)

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState)
    resizeObserver?.observe(list)
    const mutationObserver =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(updateScrollState)
    mutationObserver?.observe(list, { childList: true, subtree: true })

    return () => {
      list.removeEventListener("scroll", updateScrollState)
      window.removeEventListener("resize", updateScrollState)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [])

  function handleTabChange(nextValue: string) {
    setActiveValue(nextValue)

    if (typeof window === "undefined") {
      return
    }

    // Defer to next paint so Radix has swapped the TabsContent before we
    // measure the scroll position.
    requestAnimationFrame(() => {
      const scroller = document.querySelector<HTMLElement>("[data-app-scroll-container='true']")
      const tabsRoot = tabsRootRef.current
      if (!scroller || !tabsRoot) {
        return
      }

      // Compute the scroll position where the tabs root sits at the top of
      // the scroll container. The tabs root itself is NOT sticky (only the
      // inner tab bar div is), so its bounding rect reflects its real
      // position in the document flow.
      const scrollerRect = scroller.getBoundingClientRect()
      const tabsRect = tabsRoot.getBoundingClientRect()
      const tabsRootTopInScroller = scroller.scrollTop + (tabsRect.top - scrollerRect.top)

      // Only scroll UP to the tabs root — never scroll down. This prevents
      // the jolt when the user is near the top of the page (no scroll happens)
      // but resets the view when they've scrolled into the previous tab's
      // content and the new tab should start from the top.
      if (scroller.scrollTop > tabsRootTopInScroller) {
        scroller.scrollTop = tabsRootTopInScroller
      }
    })
  }

  function centerTabHorizontally(tab: HTMLElement) {
    const list = tabListRef.current

    if (!list) {
      return
    }

    const tabRect = tab.getBoundingClientRect()
    const listRect = list.getBoundingClientRect()
    const tabCenter = tabRect.left + tabRect.width / 2
    const listCenter = listRect.left + list.clientWidth / 2
    const maxScrollLeft = list.scrollWidth - list.clientWidth
    const targetScroll = Math.max(
      0,
      Math.min(maxScrollLeft, list.scrollLeft + (tabCenter - listCenter)),
    )

    if (Math.abs(targetScroll - list.scrollLeft) < 1) {
      return
    }

    list.scrollTo({ left: targetScroll, behavior: "smooth" })
  }

  if (!defaultValue) {
    return null
  }

  return (
    <Tabs
      ref={tabsRootRef}
      value={effectiveActiveValue}
      onValueChange={handleTabChange}
      className="gap-0 overflow-visible"
    >
      <div className="sticky top-0 z-20 border-y border-[var(--gray-border)]/30 bg-[var(--surface-dark)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/85">
        <TabsList
          ref={tabListRef}
          variant="line"
          aria-label="Scan detail sections"
          className="flex !h-auto min-h-10 w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none px-2 py-0 pr-12 [-ms-overflow-style:none] [scrollbar-width:none] sm:min-h-11 sm:py-0 sm:pr-2 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const Icon = scanDetailSectionTabIcons[item.value] ?? FileText

            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                className="!h-9 flex-none cursor-pointer gap-1.5 rounded-none border-0 px-2.5 py-0 font-heading text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--muted-foreground)] after:!bottom-[-1px] after:bg-[var(--accent)] after:transition-all hover:text-[var(--foreground)] aria-selected:bg-transparent aria-selected:!text-[var(--accent)] data-active:text-[var(--accent)] data-[state=active]:text-[var(--accent)] sm:!h-10 sm:text-[11px]"
                onClick={(event) => {
                  centerTabHorizontally(event.currentTarget)
                }}
              >
                <Icon className="size-3.5 text-current sm:size-4" />
                <span>{item.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center bg-gradient-to-r from-[var(--surface-dark)] via-[var(--surface-dark)]/92 to-transparent pl-2 transition-opacity duration-200 lg:hidden",
            tabScrollState.canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="flex size-6 items-center justify-center border border-[var(--gray-border)]/25 bg-[var(--surface-mid)]/50 text-[var(--accent)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.95)]">
            <ChevronLeft className="size-3.5" />
          </span>
        </div>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 flex w-16 items-center justify-end bg-gradient-to-l from-[var(--surface-dark)] via-[var(--surface-dark)]/92 to-transparent pr-2 transition-opacity duration-200 lg:hidden",
            tabScrollState.canScrollRight ? "opacity-100" : "opacity-0",
          )}
        >
          <span className="flex size-6 items-center justify-center border border-[var(--accent)]/35 bg-[var(--surface-mid)]/65 text-[var(--accent)] shadow-[0_8px_24px_-16px_rgba(0,0,0,0.95)]">
            <ChevronRight className="size-3.5" />
          </span>
        </div>
      </div>

      <div className="min-w-0 pt-4">
        {items.map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            className="m-0 p-0 [&>section]:border-0 [&>section]:bg-transparent [&>section]:shadow-none [&>section]:ring-0"
          >
            {item.content}
          </TabsContent>
        ))}
      </div>
    </Tabs>
  )
}
