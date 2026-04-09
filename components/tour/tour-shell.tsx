"use client"

import { useCallback, useState } from "react"
import { TourManager } from "./tour-manager"

export function TourShell({ completedTours: initialCompletedTours }: { completedTours: string[] }) {
  const [completedTours, setCompletedTours] = useState(initialCompletedTours)

  const handleCompleteTour = useCallback(async (tourId: string) => {
    const rollbackTours = completedTours
    const nextTours = completedTours.includes(tourId) ? completedTours : [...completedTours, tourId]

    setCompletedTours(nextTours)

    const response = await fetch("/api/v1/me/product-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completeTourId: tourId }),
    })

    if (!response.ok) {
      setCompletedTours(rollbackTours)
      throw new Error(`Unable to persist completed tour ${tourId}.`)
    }
  }, [completedTours])

  return (
    <TourManager
      completedTours={completedTours}
      onCompleteTour={handleCompleteTour}
    />
  )
}
