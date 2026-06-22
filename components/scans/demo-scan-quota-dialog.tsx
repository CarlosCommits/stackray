"use client"

import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export const STACKRAY_RAILWAY_TEMPLATE_URL = "https://railway.com/templates/stackray"

interface DemoScanQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DemoScanQuotaDialog({ open, onOpenChange }: DemoScanQuotaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Demo scan limit reached</DialogTitle>
          <DialogDescription>
            You have used today&apos;s 10 demo scans. Try again tomorrow, or launch your own Stackray instance on Railway to keep scanning.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 rounded-lg border border-[var(--gray-border)] bg-[var(--surface-mid)] p-4 text-sm text-[var(--text-dim)]">
          <p className="font-medium text-[var(--foreground)]">Your own deployment includes:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Scheduled scans</li>
            <li>API key access</li>
            <li>User invites for your team</li>
          </ul>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
          <Button asChild>
            <a href={STACKRAY_RAILWAY_TEMPLATE_URL} target="_blank" rel="noreferrer">
              <Image
                src="/railway-logo.svg"
                alt=""
                width={16}
                height={16}
                data-icon="inline-start"
                aria-hidden="true"
              />
              Launch on Railway
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
