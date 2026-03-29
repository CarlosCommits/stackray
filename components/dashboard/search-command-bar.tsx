"use client"

import { useId, useState, type ComponentProps } from "react"
import { useRouter } from "next/navigation"
import { Search, Zap } from "lucide-react"
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
          targets: [trimmedTarget],
          profile: "stack-deep",
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
      <InputGroup className="mx-auto h-auto w-full max-w-5xl rounded-2xl border-[var(--gray-border)] bg-[var(--surface-mid)] p-2 shadow-2xl has-[data-slot=input-group-control]:focus-within:border-[var(--accent)] has-[data-slot=input-group-control]:focus-within:ring-2 has-[data-slot=input-group-control]:focus-within:ring-[var(--accent)]/50">
        <InputGroupAddon align="inline-start" className="pl-1">
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
        <InputGroupAddon align="inline-end" className="pr-0.5">
          <Button
            type="submit"
            size="default"
            className="h-10 min-w-36 rounded-xl bg-[var(--accent)] px-8 text-xs font-bold uppercase tracking-[0.22em] text-[var(--primary-foreground)] shadow-lg shadow-[var(--accent)]/20 transition-all hover:bg-[var(--accent)]/85 hover:shadow-[var(--accent)]/30"
            disabled={isSubmitting}
          >
            <Zap className="mr-1.5 size-3.5" data-icon="inline-start" />
            {isSubmitting ? "Queueing…" : "Scan"}
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
