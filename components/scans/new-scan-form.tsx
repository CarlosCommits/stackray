"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgePlus, Radar } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface NewScanFormProps {
  initialTarget?: string
}

function buildTargets(primaryTarget: string, targetList: string): string[] {
  return [...new Set([primaryTarget, ...targetList.split("\n")].map((value) => value.trim()).filter(Boolean))]
}

export function NewScanForm({ initialTarget = "https://tpss.coop" }: NewScanFormProps) {
  const router = useRouter()
  const [primaryTarget, setPrimaryTarget] = useState(initialTarget)
  const [targetList, setTargetList] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const targets = buildTargets(primaryTarget, targetList)

    if (targets.length === 0) {
      setError("Enter at least one public target to queue a scan.")
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
          targets,
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
      <div className="flex items-center gap-2">
        <BadgePlus className="w-5 h-5 text-[var(--accent)]" />
        <h1 className="font-[var(--font-heading)] text-xl font-bold text-[var(--foreground)]">
          New Scan
        </h1>
      </div>

      <Card className="max-w-3xl bg-[var(--surface-dark)] border-[var(--gray-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--foreground)]">Scan Configuration</CardTitle>
          <CardDescription className="text-[var(--text-dim)]">
            Queue a Stackray scan against one target or a small batch. Results stream into the same history, search, and detail pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="target" className="text-[var(--foreground)]">Primary target</Label>
            <Input
              id="target"
              value={primaryTarget}
              onChange={(event) => setPrimaryTarget(event.target.value)}
              className="bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-list" className="text-[var(--foreground)]">Optional target list</Label>
            <Textarea
              id="target-list"
              value={targetList}
              onChange={(event) => setTargetList(event.target.value)}
              placeholder="https://example.com&#10;https://docs.example.com"
              className="min-h-36 bg-[var(--surface-mid)] border-[var(--gray-border)] text-[var(--foreground)]"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4">
            <div className="space-y-1">
              <p className="font-medium text-[var(--foreground)]">Execution mode</p>
              <p className="text-sm text-[var(--text-dim)]">Scans queue asynchronously and are picked up by the local worker process.</p>
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
