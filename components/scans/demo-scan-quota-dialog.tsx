"use client"

import { CalendarClock, KeyRound, Users } from "lucide-react"

import { DemoDeploymentPrompt, STACKRAY_RAILWAY_TEMPLATE_URL } from "@/components/demo/demo-deployment-cta"
export { STACKRAY_RAILWAY_TEMPLATE_URL }

interface DemoScanQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const deploymentFeatures = [
  { icon: CalendarClock, label: "Scheduled scans" },
  { icon: KeyRound, label: "API key access" },
  { icon: Users, label: "User invites for your team" },
]

export function DemoScanQuotaDialog({ open, onOpenChange }: DemoScanQuotaDialogProps) {
  return (
    <DemoDeploymentPrompt
      open={open}
      onOpenChange={onOpenChange}
      source="demo_quota_dialog"
      title="Scan limit reached"
      description="You've used the scans available here today. Try again tomorrow, or launch your own Stackray instance on Railway to keep scanning and unlock additional features."
      features={deploymentFeatures}
    />
  )
}
