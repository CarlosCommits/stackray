"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function copyWithSelection(value: string, trigger: HTMLElement) {
  const previouslyFocused = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
  const control = value.includes("\n")
    ? document.createElement("textarea")
    : document.createElement("input")

  control.value = value
  control.setAttribute("aria-hidden", "true")
  control.setAttribute("data-clipboard-fallback", "")
  control.style.position = "fixed"
  control.style.left = "0"
  control.style.top = "0"
  control.style.fontSize = "16px"
  control.style.opacity = "0"
  const container = trigger.closest('[role="dialog"]') ?? trigger.parentElement ?? document.body
  container.append(control)
  control.focus()
  control.setSelectionRange(0, control.value.length)

  try {
    return document.execCommand("copy")
  } finally {
    control.remove()
    previouslyFocused?.focus({ preventScroll: true })
  }
}

async function copyText(value: string, trigger: HTMLElement) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Remote HTTP origins do not always permit the Clipboard API.
    }
  }

  if (typeof document.execCommand !== "function") return false

  try {
    return copyWithSelection(value, trigger)
  } catch {
    return false
  }
}

export function CopyTextButton({
  value,
  ariaLabel,
  tooltip,
}: {
  value: string
  ariaLabel: string
  tooltip: string
}) {
  const [copied, setCopied] = useState(false)
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    }
  }, [])

  async function copyValue(trigger: HTMLButtonElement) {
    const didCopy = await copyText(value, trigger)
    if (!didCopy) {
      toast.error("Could not copy to the clipboard")
      return
    }

    setCopied(true)
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current)
    resetTimeoutRef.current = setTimeout(() => {
      setCopied(false)
      resetTimeoutRef.current = null
    }, 1600)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={ariaLabel}
          onClick={(event) => void copyValue(event.currentTarget)}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{copied ? "Copied" : tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function CopyFingerprintButton({
  value,
  label,
}: {
  value: string
  label: string
}) {
  return (
    <CopyTextButton
      value={value}
      ariaLabel={`Copy ${label} fingerprint`}
      tooltip="Copy full fingerprint"
    />
  )
}
