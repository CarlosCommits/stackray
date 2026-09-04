"use client"

import Link, { useLinkStatus } from "next/link"
import { useSelectedLayoutSegment } from "next/navigation"

import { ChangeTargetIcon } from "@/components/changes/change-target-icon"
import { TargetScanButton } from "@/components/targets/profile/target-scan-button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatTargetForDisplay } from "@/lib/targets/display-target"

export type TargetProfileIdentity = {
  canonicalTargetId: string
  target: string
  inputTarget: string
  title: string
  faviconUrl: string | null
  latestScanId: string
  latestScanStatus: string
  lastScannedAt: string
  finalUrl: string
  statusCode: number | null
  hostIp: string | null
  server: string | null
  technologies: string[]
  tlsObserved: boolean
  canRunScans: boolean
  canManageBaseline: boolean
}

const profileTabs = [
  { value: "overview", label: "Overview", suffix: "" },
  { value: "changes", label: "Changes", suffix: "/changes" },
  { value: "scans", label: "Scans", suffix: "/scans" },
  { value: "monitoring", label: "Monitoring", suffix: "/monitoring" },
] as const

function TargetProfileTabPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 bg-[var(--accent)] opacity-0 transition-opacity data-[pending=true]:animate-pulse data-[pending=true]:opacity-100 motion-reduce:animate-none"
    />
  )
}

export function TargetProfileShell({
  identity,
  children,
}: {
  identity: TargetProfileIdentity
  children: React.ReactNode
}) {
  const selectedSegment = useSelectedLayoutSegment()
  const basePath = `/targets/${identity.canonicalTargetId}`
  const activeTab = profileTabs.find((tab) => tab.value === selectedSegment)?.value ?? "overview"
  const targetLabel = formatTargetForDisplay(identity.target)

  return (
    <Card className="gap-0 overflow-visible py-0">
      <div className="grid min-h-28 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-6 sm:py-6">
        <ChangeTargetIcon faviconUrl={identity.faviconUrl} size="large" />
        <div className="min-w-0">
          <h2 className="truncate font-heading text-xl font-semibold tracking-tight text-foreground">{targetLabel}</h2>
          <a
            href={identity.finalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full truncate text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">{identity.finalUrl}</span>
          </a>
        </div>

        {identity.canRunScans ? (
          <div className="col-start-2 row-start-2 justify-self-start sm:col-start-3 sm:row-start-1 sm:justify-self-end">
            <TargetScanButton key={identity.canonicalTargetId} target={identity.target} />
          </div>
        ) : null}
      </div>

      <Tabs value={activeTab} className="gap-0">
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
          <TabsList variant="line" className="!h-14 min-h-14 w-full justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-none border-b px-3 sm:px-5">
            {profileTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                asChild
                className="h-14 flex-none rounded-none px-3 after:!bottom-0 after:h-0.5 after:bg-[var(--accent)] has-data-[pending=true]:text-[var(--accent)] data-active:text-[var(--accent)] data-active:after:opacity-100 data-[state=active]:text-[var(--accent)] data-[state=active]:after:opacity-100"
              >
                <Link href={`${basePath}${tab.suffix}`}>
                  {tab.label}
                  <TargetProfileTabPendingIndicator />
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {profileTabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            forceMount
            className="m-0 min-w-0 data-[state=inactive]:hidden"
          >
            {tab.value === activeTab ? children : null}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  )
}
