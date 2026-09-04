"use client"

import { BellRing, CalendarClock, KeyRound, LockKeyhole, Users } from "lucide-react"

import { DemoDeploymentPrompt } from "@/components/demo/demo-deployment-cta"

interface DemoScanCreatedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const deploymentFeatures = [
  { icon: LockKeyhole, label: "Private scans and history" },
  { icon: Users, label: "Team accounts with passwords" },
  { icon: CalendarClock, label: "Scheduled scans" },
  { icon: BellRing, label: "Change alerts" },
  { icon: KeyRound, label: "API keys for automation" },
]

export function DemoScanCreatedDialog({ open, onOpenChange }: DemoScanCreatedDialogProps) {
  return (
    <DemoDeploymentPrompt
      open={open}
      onOpenChange={onOpenChange}
      source="demo_scan_created_prompt"
      title="Your scan is running"
      description={(
        <>
          Scans on this shared demo are public. Stackray is free and{" "}
          <a
            href="https://github.com/CarlosCommits/stackray"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--foreground)] underline decoration-[var(--accent)]/70 underline-offset-4 hover:text-[var(--accent)]"
            data-umami-event="github_click"
            data-umami-event-source="demo_scan_created_prompt"
          >
            open source
          </a>
          . Launch your own instance on Railway in one click for private scanning and full control.
        </>
      )}
      features={deploymentFeatures}
      featureGridClassName="grid-cols-2"
    />
  )
}
