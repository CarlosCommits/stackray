"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getTourForRoute, type TourConfig, type TourStep } from "./tours"
import { TourTooltip } from "./tour-tooltip"

interface TourManagerProps {
  completedTours: string[]
  onCompleteTour: (tourId: string) => void
}

type TourState =
  | { status: "idle" }
  | { status: "running"; tour: TourConfig; stepIndex: number }

export function TourManager({ completedTours, onCompleteTour }: TourManagerProps) {
  const pathname = usePathname()
  const [state, setState] = useState<TourState>({ status: "idle" })
  const prevPathnameRef = useRef(pathname)

  useEffect(() => {
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname
    setState({ status: "idle" })
  }, [pathname])

  useEffect(() => {
    if (state.status !== "idle") return

    const tour = getTourForRoute(pathname)
    if (!tour) return
    if (completedTours.includes(tour.id)) return

    const timer = window.setTimeout(() => {
      setState({ status: "running", tour, stepIndex: 0 })
    }, 600)

    return () => window.clearTimeout(timer)
  }, [pathname, completedTours, state.status])

  const handleClose = useCallback(() => {
    if (state.status !== "running") return
    onCompleteTour(state.tour.id)
    setState({ status: "idle" })
  }, [state, onCompleteTour])

  const handleNext = useCallback(() => {
    if (state.status !== "running") return
    const nextIndex = state.stepIndex + 1
    if (nextIndex >= state.tour.steps.length) {
      onCompleteTour(state.tour.id)
      setState({ status: "idle" })
    } else {
      setState({ status: "running", tour: state.tour, stepIndex: nextIndex })
    }
  }, [state, onCompleteTour])

  const handlePrev = useCallback(() => {
    if (state.status !== "running") return
    if (state.stepIndex > 0) {
      setState({ status: "running", tour: state.tour, stepIndex: state.stepIndex - 1 })
    }
  }, [state])

  const handleFinish = useCallback(() => {
    if (state.status !== "running") return
    onCompleteTour(state.tour.id)
    setState({ status: "idle" })
  }, [state, onCompleteTour])

  if (state.status !== "running") return null

  const currentStep: TourStep = state.tour.steps[state.stepIndex]

  return (
    <TourTooltip
      step={currentStep}
      stepIndex={state.stepIndex}
      totalSteps={state.tour.steps.length}
      onNext={handleNext}
      onPrev={handlePrev}
      onClose={handleClose}
      onFinish={handleFinish}
    />
  )
}