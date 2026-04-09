"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { TourStep } from "./tours"

const PLACEMENT_OFFSET = 12

function getTooltipStyle(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TourStep["placement"],
): CSSProperties {
  const scrollX = window.scrollX
  const scrollY = window.scrollY

  switch (placement) {
    case "top":
      return {
        position: "absolute",
        top: targetRect.top + scrollY - tooltipRect.height - PLACEMENT_OFFSET,
        left: targetRect.left + scrollX + targetRect.width / 2 - tooltipRect.width / 2,
      }
    case "bottom":
      return {
        position: "absolute",
        top: targetRect.bottom + scrollY + PLACEMENT_OFFSET,
        left: targetRect.left + scrollX + targetRect.width / 2 - tooltipRect.width / 2,
      }
    case "left":
      return {
        position: "absolute",
        top: targetRect.top + scrollY + targetRect.height / 2 - tooltipRect.height / 2,
        left: targetRect.left + scrollX - tooltipRect.width - PLACEMENT_OFFSET,
      }
    case "right":
      return {
        position: "absolute",
        top: targetRect.top + scrollY + targetRect.height / 2 - tooltipRect.height / 2,
        left: targetRect.right + scrollX + PLACEMENT_OFFSET,
      }
    default:
      return {
        position: "absolute",
        top: targetRect.bottom + scrollY + PLACEMENT_OFFSET,
        left: targetRect.left + scrollX + targetRect.width / 2 - tooltipRect.width / 2,
      }
  }
}

function getArrowStyle(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TourStep["placement"],
): CSSProperties {
  const arrowSize = 6

  switch (placement) {
    case "top":
      return {
        position: "absolute",
        bottom: -arrowSize,
        left: targetRect.left + targetRect.width / 2 - (tooltipRect.left) + arrowSize / 2,
        borderLeft: `${arrowSize}px solid transparent`,
        borderRight: `${arrowSize}px solid transparent`,
        borderTop: `${arrowSize}px solid var(--surface-dark)`,
      }
    case "bottom":
      return {
        position: "absolute",
        top: -arrowSize,
        left: targetRect.left + targetRect.width / 2 - (tooltipRect.left) + arrowSize / 2,
        borderLeft: `${arrowSize}px solid transparent`,
        borderRight: `${arrowSize}px solid transparent`,
        borderBottom: `${arrowSize}px solid var(--surface-dark)`,
      }
    case "left":
      return {
        position: "absolute",
        right: -arrowSize,
        top: targetRect.top + targetRect.height / 2 - (tooltipRect.top) + arrowSize / 2,
        borderTop: `${arrowSize}px solid transparent`,
        borderBottom: `${arrowSize}px solid transparent`,
        borderLeft: `${arrowSize}px solid var(--surface-dark)`,
      }
    case "right":
      return {
        position: "absolute",
        left: -arrowSize,
        top: targetRect.top + targetRect.height / 2 - (tooltipRect.top) + arrowSize / 2,
        borderTop: `${arrowSize}px solid transparent`,
        borderBottom: `${arrowSize}px solid transparent`,
        borderRight: `${arrowSize}px solid var(--surface-dark)`,
      }
    default:
      return {
        position: "absolute",
        top: -arrowSize,
        left: targetRect.left + targetRect.width / 2 - (tooltipRect.left) + arrowSize / 2,
        borderLeft: `${arrowSize}px solid transparent`,
        borderRight: `${arrowSize}px solid transparent`,
        borderBottom: `${arrowSize}px solid var(--surface-dark)`,
      }
  }
}

interface TourTooltipProps {
  step: TourStep
  stepIndex: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
  onFinish: () => void
}

export function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onFinish,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const [arrowPosition, setArrowPosition] = useState<CSSProperties | null>(null)
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null)

  const isLast = stepIndex === totalSteps - 1
  const isFirst = stepIndex === 0

  useEffect(() => {
    function positionTooltip() {
      const target = document.querySelector(`[data-tour="${step.target}"]`)
      if (!target || !tooltipRef.current) return

      const targetRect = target.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()

      setHighlightRect(targetRect)
      setPosition(getTooltipStyle(targetRect, tooltipRect, step.placement))
      setArrowStyle(targetRect, tooltipRect, step.placement)
    }

    positionTooltip()

    const observer = new ResizeObserver(positionTooltip)
    observer.observe(document.body)

    window.addEventListener("scroll", positionTooltip, true)
    window.addEventListener("resize", positionTooltip)

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", positionTooltip, true)
      window.removeEventListener("resize", positionTooltip)
    }

    function setArrowStyle(
      targetRect: DOMRect,
      tooltipRect: DOMRect,
      placement: TourStep["placement"],
    ) {
      setArrowPosition(getArrowStyle(targetRect, tooltipRect, placement))
    }
  }, [step.target, step.placement])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        if (isLast) {
          onFinish()
        } else {
          onNext()
        }
      } else if (event.key === "ArrowLeft") {
        if (!isFirst) {
          onPrev()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isLast, isFirst, onNext, onPrev, onClose, onFinish])

  if (!position) return null

  return (
    <>
      <div
        className="fixed inset-0 z-[9000] bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {highlightRect && (
        <div
          className="fixed z-[9001] rounded-md ring-2 ring-[var(--accent)]"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.4)",
          }}
        />
      )}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={step.title ?? `Tour step ${stepIndex + 1} of ${totalSteps}`}
        className="z-[9002] w-72 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-dark)] p-4 shadow-xl"
        style={position}
      >
        {arrowPosition && (
          <div style={arrowPosition} aria-hidden="true" />
        )}
        {step.title && (
          <h3 className="mb-1 text-sm font-semibold text-[var(--foreground)]">
            {step.title}
          </h3>
        )}
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          {step.content}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[var(--text-dim)]/60">
            {stepIndex + 1} / {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={onPrev}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-[var(--text-dim)] hover:text-[var(--foreground)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={isLast ? onFinish : onNext}
              className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--primary-foreground)] hover:bg-[var(--accent)]/85 transition-colors"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}