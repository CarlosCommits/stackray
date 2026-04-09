"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Globe,
  Key,
  LayoutGrid,
  Loader2,
  Rocket,
  Scan,
  ShieldCheck,
  Users,
} from "lucide-react"

type SetupPhase = "initial" | "in_progress" | "completed"

interface SetupPageClientProps {
  publicUrl: string | null
  detectedPublicUrl: string | null
  hasUsers: boolean
  hasTokens: boolean
  hasScans: boolean
  isSetupComplete: boolean
}

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  done: boolean
}

function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const completedCount = items.filter((item) => item.done).length

  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <Rocket className="size-5 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
              Getting started
            </CardTitle>
            <CardDescription className="text-sm text-[var(--text-dim)]">
              {completedCount === items.length
                ? "All steps complete — your instance is ready."
                : `${completedCount} of ${items.length} steps completed`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y divide-[var(--gray-border)]">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                {item.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="size-5 shrink-0 text-[var(--text-dim)]" />
                )}
                <Icon className="size-4 shrink-0 text-[var(--text-dim)]" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.done ? "text-[var(--text-dim)]" : "text-[var(--foreground)]"}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">{item.description}</p>
                </div>
                {item.done ? (
                  <Badge variant="outline" className="shrink-0 border-emerald-500/40 text-emerald-400">
                    Done
                  </Badge>
                ) : (
                  <Link
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--accent)] hover:underline"
                  >
                    Go
                    <ArrowRight className="size-3" />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}

function PublicUrlForm({
  publicUrl,
  isSaving,
  onSave,
}: {
  publicUrl: string | null
  isSaving: boolean
  onSave: (url: string) => void
}) {
  const [url, setUrl] = useState(publicUrl ?? "")

  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10">
            <Globe className="size-5 text-[var(--accent)]" />
          </div>
          <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
            Public URL
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-[var(--text-dim)]">
          This is the URL others will use to reach your Stackray instance. Confirm or update it below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSave(url.trim())
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="public-url" className="text-[var(--foreground)]">
              Instance URL
            </Label>
            <Input
              id="public-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="border-[var(--gray-border)] bg-[var(--surface-mid)] text-[var(--foreground)]"
              placeholder="https://stackray.example.com"
              required
              disabled={isSaving}
            />
            <p className="text-xs text-[var(--text-dim)]">
              Used for callback URLs, email links, and API endpoint generation.
            </p>
          </div>
          <Button
            type="submit"
            disabled={isSaving || !url.trim()}
            className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Confirm URL
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CompletedCard({ publicUrl }: { publicUrl: string }) {
  return (
    <Card className="border-[var(--gray-border)] bg-[var(--surface-dark)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
            <ShieldCheck className="size-5 text-emerald-400" />
          </div>
          <CardTitle className="text-base font-semibold text-[var(--foreground)] md:text-lg">
            Setup complete
          </CardTitle>
        </div>
        <CardDescription className="text-sm text-[var(--text-dim)]">
          Your Stackray instance is ready. Your public URL is set to:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--foreground)]">Public URL confirmed</p>
          </div>
          <code className="block max-w-full overflow-x-auto rounded bg-[var(--surface-dark)] px-3 py-2 text-xs font-mono text-[var(--foreground)]">
            {publicUrl}
          </code>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Next steps</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href="/settings/users"
              className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]"
            >
              <Users className="size-4 text-[var(--text-dim)]" />
              <span>Manage users</span>
            </Link>
            <Link
              href="/settings/tokens"
              className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]"
            >
              <Key className="size-4 text-[var(--text-dim)]" />
              <span>API tokens</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]"
            >
              <LayoutGrid className="size-4 text-[var(--text-dim)]" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function buildChecklistItems(props: {
  publicUrl: string | null
  hasUsers: boolean
  hasTokens: boolean
  hasScans: boolean
}): ChecklistItem[] {
  return [
    {
      id: "public-url",
      label: "Confirm public URL",
      description: "Set the URL others use to reach this instance.",
      href: "#public-url",
      icon: Globe,
      done: props.publicUrl !== null,
    },
    {
      id: "invite-user",
      label: "Invite a teammate",
      description: "Add users so your team can log in.",
      href: "/settings/users",
      icon: Users,
      done: props.hasUsers,
    },
    {
      id: "create-token",
      label: "Create an API token",
      description: "Generate a bearer token for CLI or automation access.",
      href: "/settings/tokens",
      icon: Key,
      done: props.hasTokens,
    },
    {
      id: "first-scan",
      label: "Run your first scan",
      description: "Scan a target to see Stackray in action.",
      href: "/scans/new",
      icon: Scan,
      done: props.hasScans,
    },
  ]
}

export function SetupPageClient({ publicUrl, detectedPublicUrl, hasUsers, hasTokens, hasScans, isSetupComplete }: SetupPageClientProps) {
  const [phase, setPhase] = useState<SetupPhase>(isSetupComplete ? "completed" : "initial")
  const [confirmedUrl, setConfirmedUrl] = useState(publicUrl ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checklistItems = buildChecklistItems({
    publicUrl: phase === "completed" ? confirmedUrl : publicUrl,
    hasUsers,
    hasTokens,
    hasScans,
  })

  const handleSaveUrl = async (url: string) => {
    setError(null)
    setIsSaving(true)
    setPhase("in_progress")

    try {
      const response = await fetch("/api/v1/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicUrl: url }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setError(payload?.error?.message ?? "Unable to save the public URL.")
        setPhase("initial")
        return
      }

      setConfirmedUrl(payload?.publicUrl ?? url)
      setPhase("completed")
    } catch {
      setError("A network error occurred. Please try again.")
      setPhase("initial")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Setup</h1>
          <p className="text-sm text-[var(--text-dim)]">
            Configure your Stackray instance before inviting the team.
          </p>
        </div>
        {phase === "completed" && (
          <Badge variant="outline" className="shrink-0 self-start border-emerald-500/40 text-emerald-400 md:self-auto">
            <CheckCircle2 className="size-3" />
            Configured
          </Badge>
        )}
      </div>

      <SetupChecklist items={checklistItems} />

      {phase === "completed" ? (
        <CompletedCard publicUrl={confirmedUrl} />
      ) : (
        <PublicUrlForm
          publicUrl={publicUrl ?? detectedPublicUrl}
          isSaving={isSaving}
          onSave={handleSaveUrl}
        />
      )}

      {error && (
        <p aria-live="polite" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}