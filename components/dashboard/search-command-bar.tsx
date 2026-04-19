"use client"

import { useId, useState, type ComponentProps } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"

export function SearchCommandBar() {
  const router = useRouter()
  const [target, setTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputId = useId()

  const handleQueueScan = async () => {
    const trimmedTarget = target.trim()

    if (!trimmedTarget) {
      router.push("/scans/new")
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/v1/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: trimmedTarget,
          options: {
            followRedirects: true,
            includeRawResponse: false,
            headless: false,
          },
          client: {
            source: "ui",
          },
        }),
      })

      if (!response.ok) {
        router.push(`/scans/new?target=${encodeURIComponent(trimmedTarget)}`)
        return
      }

      const payload = await response.json()
      router.push(`/scans/${payload.scanId}`)
      router.refresh()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
    event.preventDefault()
    await handleQueueScan()
  }

  return (
    <form className="mb-6 w-full" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="sr-only">
        Target domain or URL
      </label>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <InputGroup className="h-auto flex-1 rounded-xl border-[var(--gray-border)] bg-[var(--surface-mid)] px-2 py-1 shadow-2xl has-[data-slot=input-group-control]:focus-within:border-[var(--accent)] has-[data-slot=input-group-control]:focus-within:ring-2 has-[data-slot=input-group-control]:focus-within:ring-[var(--accent)]/50">
          <InputGroupAddon align="inline-start" className="pl-0.5">
            <Search className="size-4 text-[var(--accent)]" />
          </InputGroupAddon>
          <InputGroupInput
            id={inputId}
            name="target"
            type="text"
            autoComplete="off"
            placeholder="Enter a domain or URL…"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="h-10 px-1 text-sm font-mono text-[var(--foreground)] placeholder:text-[var(--text-dim)]/40"
          />
        </InputGroup>

        <div className="shrink-0">
          <Button
            type="submit"
            size="default"
            className="h-10 w-full min-w-36 justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--primary-foreground)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent)]/85 hover:shadow-[var(--accent)]/30 sm:w-auto"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Queueing…" : "Scan"}
          </Button>
        </div>
      </div>
    </form>
  )
}
