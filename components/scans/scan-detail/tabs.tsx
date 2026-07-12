"use client"

import { useEffect, useRef, useState } from "react"
import type * as React from "react"
import {
  FileText,
  Fingerprint,
  Radar,
  Info,
  Layers,
  Lock,
  MapPin,
  Network,
} from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { trackStackrayEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

export type ScanDetailSectionTabItem = {
  value: string
  label: string
  mobileLabel?: string
  content: React.ReactNode
}

const scanDetailSectionAnalyticsNames: Record<string, string> = {
  technologies: "technologies",
  subdomains: "subdomains",
  dnsInfrastructure: "dns",
  ipIntelligence: "ip_intelligence",
  domainInfo: "domain_info",
  tlsCertificate: "tls",
  fingerprints: "fingerprints",
  scanInfo: "scan_info",
  rawEvidence: "raw_evidence",
}

const scanDetailSectionTabIcons: Record<string, React.ElementType> = {
  technologies: Layers,
  dnsInfrastructure: Network,
  ipIntelligence: MapPin,
  subdomains: Radar,
  tlsCertificate: Lock,
  fingerprints: Fingerprint,
  domainInfo: FileText,
  rawEvidence: FileText,
  scanInfo: Info,
}

export function ScanDetailSectionTabs({
  items,
  initialValue,
}: {
  items: ScanDetailSectionTabItem[]
  initialValue?: string
}) {
  const defaultValue = items[0]?.value
  const initialActiveValue = initialValue && items.some((item) => item.value === initialValue)
    ? initialValue
    : undefined
  const [activeValue, setActiveValue] = useState<string | undefined>(initialActiveValue)
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

  useEffect(() => {
    function handlePopState() {
      const section = new URLSearchParams(window.location.search).get("section")
      setActiveValue(section && items.some((item) => item.value === section) ? section : undefined)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [items])

  function handleTabChange(nextValue: string) {
    setActiveValue(nextValue)

    if (typeof window === "undefined") {
      return
    }

    const url = new URL(window.location.href)
    url.searchParams.set("section", nextValue)
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`)

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

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    list.scrollTo({ left: targetScroll, behavior: reduceMotion ? "auto" : "smooth" })
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
      <div className="sticky top-0 z-20 -mx-4 border-y border-[var(--gray-border)]/30 bg-[var(--surface-dark)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--surface-dark)]/85 sm:mx-0">
        <TabsList
          ref={tabListRef}
          variant="line"
          aria-label="Scan detail sections"
          className="flex !h-auto min-h-11 w-full snap-x snap-mandatory scroll-px-3 justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none px-3 py-0 touch-manipulation [-ms-overflow-style:none] [scrollbar-width:none] sm:scroll-px-2 sm:px-2 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const Icon = scanDetailSectionTabIcons[item.value] ?? FileText

            return (
              <TabsTrigger
                key={item.value}
                value={item.value}
                aria-label={item.label}
                className="!h-11 flex-none snap-center cursor-pointer gap-1.5 rounded-none border-0 px-3 py-0 font-heading text-[11px] font-semibold uppercase tracking-[0.025em] text-[var(--muted-foreground)] after:!bottom-[-1px] after:bg-[var(--accent)] after:transition-opacity hover:text-[var(--foreground)] aria-selected:bg-transparent aria-selected:!text-[var(--accent)] data-active:text-[var(--accent)] data-[state=active]:text-[var(--accent)] sm:px-2.5 sm:tracking-[0.04em]"
                onClick={(event) => {
                  if (item.value !== effectiveActiveValue) {
                    trackStackrayEvent("scan_detail_tab_selected", {
                      section: scanDetailSectionAnalyticsNames[item.value] ?? item.value,
                    })
                  }
                  centerTabHorizontally(event.currentTarget)
                }}
              >
                <Icon aria-hidden="true" className="size-3.5 text-current sm:size-4" />
                <span aria-hidden="true" className={item.mobileLabel ? "sm:hidden" : undefined}>
                  {item.mobileLabel ?? item.label}
                </span>
                {item.mobileLabel ? (
                  <span aria-hidden="true" className="hidden sm:inline">{item.label}</span>
                ) : null}
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[var(--surface-dark)] via-[var(--surface-dark)]/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none lg:hidden",
            tabScrollState.canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--surface-dark)] via-[var(--surface-dark)]/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none lg:hidden",
            tabScrollState.canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />
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
