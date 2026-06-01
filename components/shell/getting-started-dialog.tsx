"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CalendarClock, KeyRound, ScanSearch, UsersRound } from "lucide-react"

interface GettingStartedDialogProps {
  onDismiss: () => Promise<void>
}

interface GettingStartedCard {
  icon: React.ComponentType<{ className?: string }>
  title: string
  eyebrow: string
  description: string
}

const cards: GettingStartedCard[] = [
  {
    icon: UsersRound,
    title: "Invite teammates",
    eyebrow: "Settings / Users",
    description: "Add operators, assign roles, and deactivate access when someone leaves the team.",
  },
  {
    icon: KeyRound,
    title: "Create API key",
    eyebrow: "Settings / API keys",
    description: "Use Stackray programmatically from scripts, integrations, or your agents.",
  },
  {
    icon: ScanSearch,
    title: "Run first scan",
    eyebrow: "Dashboard",
    description: "Submit a domain or URL and review detected technologies, DNS, screenshots, and findings.",
  },
  {
    icon: CalendarClock,
    title: "Schedule coverage",
    eyebrow: "Schedules",
    description: "Track important targets over time with recurring scans and run history.",
  },
]

export function GettingStartedDialog({ onDismiss }: GettingStartedDialogProps) {
  const [open, setOpen] = useState(true)
  const [isDismissing, setIsDismissing] = useState(false)

  async function dismissDialog() {
    if (isDismissing) {
      return
    }

    setIsDismissing(true)
    await onDismiss()
    setOpen(false)
  }

  function closeDialog() {
    if (!isDismissing) {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) closeDialog() }}>
      <DialogContent className="gap-5 border-white/10 bg-[color-mix(in_srgb,var(--surface-dark)_96%,black)] p-5 text-[var(--foreground)] shadow-[0_30px_100px_rgba(0,0,0,0.56)] sm:max-w-3xl sm:p-6">
        <DialogHeader className="pr-8">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-[var(--accent)]/80">
              First run
            </span>
          </div>
          <DialogTitle className="text-2xl font-semibold tracking-tight">Getting started</DialogTitle>
          <DialogDescription className="max-w-xl text-sm leading-6 text-[var(--text-dim)]">
            The admin account is ready. These are the areas most teams configure first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <article
                key={card.title}
                className="min-h-32 rounded-xl border border-white/10 bg-[var(--surface-mid)]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black/24 ring-1 ring-white/10">
                    <Icon className="size-4 text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--accent)]/80">{card.eyebrow}</p>
                    <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{card.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-dim)]">{card.description}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
        <div className="flex flex-col-reverse justify-end gap-2 pt-1 sm:flex-row">
          <Button variant="ghost" size="sm" onClick={closeDialog} disabled={isDismissing}>
            Close
          </Button>
          <Button size="sm" onClick={() => void dismissDialog()} disabled={isDismissing} className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/85">
            Do not show again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
