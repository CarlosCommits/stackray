"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"

import {
  BROWSER_TIME_ZONE_COOKIE_MAX_AGE_SECONDS,
  BROWSER_TIME_ZONE_COOKIE_NAME,
  isValidTimeZone,
} from "@/lib/time"

interface TimeZoneContextValue {
  timeZone: string | null
}

const TimeZoneContext = createContext<TimeZoneContextValue>({ timeZone: null })

interface TimeZoneStore {
  getSnapshot: () => string | null
  getServerSnapshot: () => string | null
  setTimeZone: (timeZone: string | null) => void
  subscribe: (listener: () => void) => () => void
}

function normalizeTimeZone(timeZone: string | null) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : null
}

function createTimeZoneStore(initialTimeZone: string | null): TimeZoneStore {
  let currentTimeZone = normalizeTimeZone(initialTimeZone)
  const initialSnapshot = currentTimeZone
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => currentTimeZone,
    getServerSnapshot: () => initialSnapshot,
    setTimeZone: (timeZone) => {
      const nextTimeZone = normalizeTimeZone(timeZone)

      if (currentTimeZone === nextTimeZone) {
        return
      }

      currentTimeZone = nextTimeZone
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function getBrowserTimeZone() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return timeZone && isValidTimeZone(timeZone) ? timeZone : null
}

function readCookieValue(name: string) {
  const prefix = `${name}=`
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))

  return cookie?.slice(prefix.length) ?? null
}

function writeTimeZoneCookie(timeZone: string) {
  document.cookie = `${BROWSER_TIME_ZONE_COOKIE_NAME}=${timeZone}; path=/; max-age=${BROWSER_TIME_ZONE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

export function TimeZoneProvider({
  children,
  initialTimeZone,
}: {
  children: ReactNode
  initialTimeZone: string | null
}) {
  const store = useMemo(() => createTimeZoneStore(initialTimeZone), [initialTimeZone])
  const timeZone = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)

  useEffect(() => {
    const browserTimeZone = getBrowserTimeZone()

    if (!browserTimeZone) {
      return
    }

    store.setTimeZone(browserTimeZone)

    if (readCookieValue(BROWSER_TIME_ZONE_COOKIE_NAME) !== browserTimeZone) {
      writeTimeZoneCookie(browserTimeZone)
    }
  }, [store])

  const value = useMemo(() => ({ timeZone }), [timeZone])

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>
}

export function useTimeZone() {
  return useContext(TimeZoneContext)
}
