"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Radar } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface NewScanFormProps {
  initialTarget?: string
}

export function NewScanForm({ initialTarget = "https://tpss.coop" }: NewScanFormProps) {
  const router = useRouter()
  const [target, setTarget] = useState(initialTarget)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const normalizedTarget = target.trim()

    if (!normalizedTarget) {
      setError("Enter a public target to queue a scan.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/v1/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: normalizedTarget,
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
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? "Unable to queue the scan.")
      }

      const payload = await response.json()
      router.push(`/scans/${payload.scanId}`)
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to queue the scan.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-3xl bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Scan Configuration</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Queue a Stackray scan against one target. Results stream into the same history, search, and detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="target" className="text-[var(--foreground)]">Target</Label>
            <Input
              id="target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
            <div className="space-y-1">
              <p className="font-medium text-[var(--foreground)]">Execution mode</p>
              <p className="text-sm text-[var(--text-dim)]">Each scan queues asynchronously for one domain or URL and is picked up by the local worker process.</p>
            </div>
            <Radar className="w-5 h-5 text-[var(--accent)]" />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" className="border-[var(--gray-border)] text-[var(--foreground)]" onClick={() => router.push("/dashboard")}>Cancel</Button>
            <Button
              className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Queueing…" : "Queue Scan"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
