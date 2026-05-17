"use client"

import { useEffect } from "react"
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react"

interface AnimatedMetricValueProps {
  value: string
}

interface AnimatedDigitProps {
  place: number
  value: number
}

interface AnimatedNumberProps {
  animatedPlaceValue: ReturnType<typeof useSpring>
  number: number
}

function getPlaceValue(value: number, place: number) {
  return Math.floor(value / place)
}

function AnimatedNumber({ animatedPlaceValue, number }: AnimatedNumberProps) {
  const y = useTransform(animatedPlaceValue, (latest) => {
    const currentDigit = latest % 10
    let offset = (10 + number - currentDigit) % 10

    if (offset > 5) {
      offset -= 10
    }

    return `${offset * 100}%`
  })

  return (
    <motion.span
      className="absolute inset-0 flex items-center justify-center"
      data-slot="dashboard-metric-counter-number"
      data-number={number}
      style={{ y }}
    >
      {number}
    </motion.span>
  )
}

function AnimatedDigit({ place, value }: AnimatedDigitProps) {
  const animatedPlaceValue = useSpring(getPlaceValue(0, place), {
    damping: 28,
    stiffness: 120,
  })

  useEffect(() => {
    animatedPlaceValue.set(getPlaceValue(value, place))
  }, [animatedPlaceValue, place, value])

  return (
    <span className="relative inline-block h-[1em] w-[1ch] overflow-hidden align-[-0.08em]" data-slot="dashboard-metric-counter-digit">
      {Array.from({ length: 10 }, (_, number) => (
        <AnimatedNumber key={number} animatedPlaceValue={animatedPlaceValue} number={number} />
      ))}
    </span>
  )
}

export function AnimatedMetricValue({ value }: AnimatedMetricValueProps) {
  const prefersReducedMotion = useReducedMotion()
  const numericValue = Number(value)

  if (!Number.isInteger(numericValue) || numericValue < 0 || prefersReducedMotion) {
    return <>{value}</>
  }

  const places = Array.from({ length: value.length }, (_, index) => 10 ** (value.length - index - 1))

  return (
    <span className="inline-flex tabular-nums" data-slot="dashboard-metric-counter">
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex">
        {places.map((place) => (
          <AnimatedDigit key={place} place={place} value={numericValue} />
        ))}
      </span>
    </span>
  )
}
