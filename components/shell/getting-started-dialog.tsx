"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Users, Key, Scan, ArrowRight } from "lucide-react"

interface GettingStartedDialogProps {
  onDismiss: () => Promise<void>
}

interface GettingStartedCard {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

const cards: GettingStartedCard[] = [
  {
    href: "/settings/users",
    icon: Users,
    title: "Invite teammates",
    description: "Add users so your team can log in and collaborate.",
  },
  {
    href: "/settings/tokens",
    icon: Key,
    title: "Create API token",
    description: "Generate a bearer token for CLI or automation access.",
  },
  {
    href: "/scans/new",
    icon: Scan,
    title: "Run first scan",
    description: "Scan a target to see Stackray in action.",
  },
]

export function GettingStartedDialog({ onDismiss }: GettingStartedDialogProps) {
  const { push } = useRouter()
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

  async function handleNavigate(href: string) {
    await dismissDialog()
    push(href)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) void dismissDialog() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Getting started</DialogTitle>
          <DialogDescription>
            A few steps to get your Stackray instance ready for the team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <Link
                key={card.href}
                href={card.href}
                onClick={(event) => {
                  event.preventDefault()
                  void handleNavigate(card.href)
                }}
                className="flex items-center gap-3 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/40 hover:bg-[var(--surface-light)]"
              >
                <Icon className="size-4 shrink-0 text-[var(--text-dim)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{card.title}</p>
                  <p className="text-xs text-[var(--text-dim)]">{card.description}</p>
                </div>
                <ArrowRight className="size-3 shrink-0 text-[var(--text-dim)]" />
              </Link>
            )
          })}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => void dismissDialog()} disabled={isDismissing}>
            Skip
          </Button>
          <Button size="sm" onClick={() => void dismissDialog()} disabled={isDismissing} className="bg-[var(--accent)] text-[var(--primary-foreground)] hover:bg-[var(--accent)]/80">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
