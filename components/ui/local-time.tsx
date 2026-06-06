"use client"

import { useMemo, useSyncExternalStore } from "react"

import {
  formatBrowserInstant,
  formatInstant,
  formatUtcInstant,
  toInstantIso,
  type TimeFormatPreset,
} from "@/lib/time"
import { useTimeZone } from "@/components/ui/time-zone-provider"

interface LocalTimeProps {
  value: string | Date | null | undefined
  preset?: TimeFormatPreset
  titlePreset?: TimeFormatPreset
  unavailableLabel?: string
  className?: string
}

const subscribeToHydration = () => () => {}
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
}

export function LocalTime({
  value,
  preset = "fullDateTimeWithZone",
  titlePreset = "fullDateTimeSecondsWithZone",
  unavailableLabel = "--",
  className,
}: LocalTimeProps) {
  const hasHydrated = useHasHydrated()
  const { timeZone } = useTimeZone()
  const instantIso = useMemo(() => toInstantIso(value), [value])
  const shouldHideUntilHydrated = !hasHydrated && !timeZone
  const formatted = useMemo(
    () => {
      if (timeZone) {
        return formatInstant(instantIso, preset, { timeZone, unavailableLabel })
      }

      return hasHydrated
        ? formatBrowserInstant(instantIso, preset, unavailableLabel)
        : formatUtcInstant(instantIso, preset, unavailableLabel)
    },
    [hasHydrated, instantIso, preset, timeZone, unavailableLabel],
  )
  const title = useMemo(
    () => {
      if (timeZone) {
        return formatInstant(instantIso, titlePreset, { timeZone, unavailableLabel })
      }

      return hasHydrated
        ? formatBrowserInstant(instantIso, titlePreset, unavailableLabel)
        : formatUtcInstant(instantIso, titlePreset, unavailableLabel)
    },
    [hasHydrated, instantIso, timeZone, titlePreset, unavailableLabel],
  )

  if (!instantIso) {
    return (
      <span className={className} suppressHydrationWarning>
        {unavailableLabel}
      </span>
    )
  }

  return (
    <time
      className={className}
      dateTime={instantIso}
      aria-hidden={shouldHideUntilHydrated ? true : undefined}
      style={shouldHideUntilHydrated ? { visibility: "hidden" } : undefined}
      title={title}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  )
}
