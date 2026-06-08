"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LocalTime } from "@/components/ui/local-time"
import {
  CheckCircle2,
  Clock,
  Globe,
  Server,
  Shield,
  ArrowLeftRight,
  MapPin,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Fingerprint,
  Database,
  Network,
  Lock,
  Globe2,
  FileText,
  Wifi,
  Eye,
  CalendarDays,
  History,
  ExternalLink as LinkIcon,
  RefreshCw,
  Star,
  Puzzle,
  Plus,
  XCircle,
  MinusCircle,
  CalendarClock,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CreateScheduleDialog, type CreateScheduleSeed } from "@/components/schedules/create-schedule-dialog"
import type { ScanPhaseRun, ScanSubdomainItem } from "@/lib/contracts/scans"
import type {
  OverviewSection,
  TechnologySection,
  DeliveryRedirectsSection,
  DnsInfrastructureSection,
  NetworkIntelligenceSection,
  SubdomainsSection,
  TlsFingerprintsSection,
  DomainIntelligenceSection,
  ContentSignalsSection,
  RawEvidenceSection,
  HistorySection,
  DomainMetadata,
  DomainProvenance,
} from "@/lib/server/scans/scan-detail-view-model"
import { RawEvidenceTabs } from "./raw-evidence-tabs"

const scanPhaseLabels: Record<ScanPhaseRun["phase"], string> = {
  http_probe: "HTTP probe",
  headless: "Headless",
  subfinder: "Subfinder",
  nuclei_dns: "Nuclei DNS",
  nuclei_http: "Nuclei HTTP",
  ip_intel: "IP intel",
  finalize: "Finalize",
}

const scanPhaseStatusClasses: Record<ScanPhaseRun["status"], string> = {
  queued: "border-[var(--gray-border)] text-[var(--muted-foreground)]",
  running: "border-[var(--accent)]/40 text-[var(--accent)]",
  completed: "border-emerald-400/30 text-emerald-400",
  failed: "border-red-400/35 text-red-400",
  skipped: "border-[var(--gray-border)] text-[var(--text-dim)]",
  cancelled: "border-amber-400/35 text-amber-400",
}

// Compact KPI Component
function CompactKPI({
  icon: Icon,
  label,
  value,
  subValue,
  color = "accent",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: "accent" | "emerald" | "amber" | "orange" | "red"
}) {
  const colorClasses = {
    accent: "text-[var(--accent)]",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    orange: "text-orange-400",
    red: "text-red-400",
  }

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--gray-border)]/20 rounded-lg p-4 hover:border-[var(--accent)]/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-5 ${colorClasses[color]}`} />
        <span className="text-sm uppercase tracking-wider text-[var(--muted-foreground)]">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      {subValue && <p className="text-sm text-[var(--muted-foreground)] mt-1">{subValue}</p>}
    </div>
  )
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  badge,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  badge?: string | number
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-[var(--gray-border)]/30 rounded-lg overflow-hidden bg-[var(--surface-dark)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[var(--surface-dark)] hover:bg-[var(--surface-mid)]/20 transition-colors border-b border-transparent data-[state=open]:border-[var(--gray-border)]/20"
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center gap-3">
          <Icon className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-lg">{title}</span>
          {badge !== undefined && badge !== "" ? (
            <Badge variant="outline" className="text-sm ml-2">
              {badge}
            </Badge>
          ) : null}
        </div>
        {isOpen ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
      </button>
      {isOpen && <div className="p-5 space-y-5 bg-[var(--background)]">{children}</div>}
    </div>
  )
}

// Target Context Badge for showing provenance
function TargetContextBadge({ provenance }: { provenance: DomainProvenance }) {
  const configs = {
    original: { label: "Original Domain", className: "border-blue-400/30 text-blue-400" },
    final: { label: "Final Domain", className: "border-emerald-400/30 text-emerald-400" },
    url: { label: "URL Target", className: "border-purple-400/30 text-purple-400" },
    unknown: { label: "Unknown", className: "border-[var(--gray-border)] text-[var(--muted-foreground)]" },
  }

  const config = configs[provenance]

  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  )
}

// Header Component
export function ScanDetailHeader({
  scanId,
  target,
  status,
  source,
  submittedAt,
  currentAttempt,
  attemptHistory,
  phases,
}: {
  scanId: string
  target: string
  status: "completed" | "running" | "failed" | "cancelled"
  source: string
  submittedAt: string
  currentAttempt: { attemptNumber: number; requestProfile: string; fallbackReason: string | null } | null
  attemptHistory: Array<{ attemptNumber: number; status: string; requestProfile: string; fallbackReason: string | null }>
  phases: ScanPhaseRun[]
}) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{target.replace(/^https?:\/\//, "")}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-[var(--muted-foreground)] flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="size-3.5" />
                  {source}
                </span>
                <span className="text-[var(--gray-border)]">|</span>
                <span className="font-mono text-xs">{scanId}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status !== "completed" && (
                <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] px-3 py-1">
                  <div className="size-2 rounded-full bg-[var(--accent)] animate-pulse mr-1.5" />
                  {status}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-[var(--gray-border)]/20 text-sm">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <CalendarDays className="size-4" />
              <span>
                Submitted{" "}
                <LocalTime value={submittedAt} preset="fullDateTimeWithZone" />
              </span>
            </div>
            {currentAttempt && attemptHistory.length > 0 && (
              <>
                <span className="hidden sm:inline text-[var(--gray-border)]">|</span>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted-foreground)]">Attempt {currentAttempt.attemptNumber}</span>
                  {currentAttempt.fallbackReason && (
                    <Badge variant="outline" className="text-xs border-amber-400/30 text-amber-400">
                      Fallback: {currentAttempt.fallbackReason}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>

          {phases.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {phases.map((phase) => (
                <Badge
                  key={phase.phaseId}
                  variant="outline"
                  className={`text-xs ${scanPhaseStatusClasses[phase.status]}`}
                  title={phase.errorMessage ?? undefined}
                >
                  {phase.status === "running" && <div className="mr-1.5 size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />}
                  {scanPhaseLabels[phase.phase]}: {phase.status}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Overview Metrics Component
export function OverviewMetrics({ overview }: { overview: OverviewSection }) {
  const getStatusColor = (code: number): "emerald" | "amber" | "orange" | "red" => {
    if (code >= 200 && code < 300) return "emerald"
    if (code >= 300 && code < 400) return "amber"
    if (code >= 400 && code < 500) return "orange"
    return "red"
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      <CompactKPI
        icon={Shield}
        label="Status"
        value={overview.statusCode}
        subValue={overview.statusText}
        color={getStatusColor(overview.statusCode)}
      />
      <CompactKPI
        icon={ArrowLeftRight}
        label="Redirects"
        value={overview.redirectCount}
        subValue={overview.redirectCount === 1 ? "1 hop" : `${overview.redirectCount} hops`}
      />
      <CompactKPI icon={Server} label="Hosted On" value={overview.server ?? "Unknown"} subValue={overview.cdnName} />
      <CompactKPI icon={MapPin} label="Host IP" value={overview.hostIp ?? "N/A"} subValue={overview.asnOrg ?? undefined} />
    </div>
  )
}

// Reusable favicon source resolver - returns safe preview source or null
export function resolveFaviconPreviewSrc(favicon: {
  url: string | null
  path: string | null
}): string | null {
  return isLocalImagePath(favicon.url)
    ? favicon.url
    : isAbsoluteHttpUrl(favicon.url)
      ? favicon.url
      : isLocalImagePath(favicon.path)
        ? favicon.path
        : isAbsoluteHttpUrl(favicon.path)
          ? favicon.path
          : null
}

// Page Title Card
export function PageTitleCard({
  title,
  finalUrl,
  favicon,
}: {
  title: string
  finalUrl: string
  favicon?: {
    url: string | null
    path: string | null
  } | null
}) {
  const faviconPreviewSrc = favicon ? resolveFaviconPreviewSrc(favicon) : null

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Page Title</p>
            <p className="text-xl font-medium">{title}</p>
          </div>
          <div className="pt-3 border-t border-[var(--gray-border)]/20">
            <p className="text-sm uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Final URL</p>
            <div className="flex items-center gap-3">
              {faviconPreviewSrc && (
                <div className="shrink-0 size-8 bg-[var(--surface-mid)] rounded overflow-hidden flex items-center justify-center">
                  {isLocalImagePath(faviconPreviewSrc) ? (
                    <Image
                      src={faviconPreviewSrc}
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
                    <img
                      src={faviconPreviewSrc}
                      alt=""
                      width={32}
                      height={32}
                      className="object-contain"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                    />
                  )}
                </div>
              )}
              <p className="text-sm font-mono text-[var(--foreground)] break-all">{finalUrl}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const technologyBucketPresentation: Record<
  TechnologySection["buckets"][number]["id"],
  { icon: React.ElementType; panelClassName: string; iconClassName: string; chipClassName: string; dotClassName: string }
> = {
  platform: {
    icon: Star,
    panelClassName: "bg-[var(--accent)]/5 border border-[var(--accent)]/10",
    iconClassName: "text-[var(--accent)] bg-[var(--accent)]/20",
    chipClassName: "border-[var(--accent)]/20 hover:border-[var(--accent)]/50",
    dotClassName: "bg-[var(--accent)]",
  },
  framework: {
    icon: Layers,
    panelClassName: "bg-sky-500/5 border border-sky-400/10",
    iconClassName: "text-sky-400 bg-sky-400/15",
    chipClassName: "border-sky-400/20 hover:border-sky-400/50",
    dotClassName: "bg-sky-400",
  },
  infrastructure: {
    icon: Server,
    panelClassName: "bg-emerald-500/5 border border-emerald-400/10",
    iconClassName: "text-emerald-400 bg-emerald-400/15",
    chipClassName: "border-emerald-400/20 hover:border-emerald-400/50",
    dotClassName: "bg-emerald-400",
  },
  business: {
    icon: Globe2,
    panelClassName: "bg-amber-500/5 border border-amber-400/10",
    iconClassName: "text-amber-400 bg-amber-400/15",
    chipClassName: "border-amber-400/20 hover:border-amber-400/50",
    dotClassName: "bg-amber-400",
  },
  security: {
    icon: Shield,
    panelClassName: "bg-red-500/5 border border-red-400/10",
    iconClassName: "text-red-400 bg-red-400/15",
    chipClassName: "border-red-400/20 hover:border-red-400/50",
    dotClassName: "bg-red-400",
  },
  ecosystem: {
    icon: Puzzle,
    panelClassName: "bg-purple-500/5 border border-purple-400/10",
    iconClassName: "text-purple-400 bg-purple-400/15",
    chipClassName: "border-purple-400/20 hover:border-purple-400/50",
    dotClassName: "bg-purple-400",
  },
  other: {
    icon: Plus,
    panelClassName: "bg-[var(--surface-mid)]/10 border border-[var(--gray-border)]/10",
    iconClassName: "text-[var(--muted-foreground)] bg-[var(--muted-foreground)]/15",
    chipClassName: "border-[var(--gray-border)]/30 hover:border-[var(--accent)]/30",
    dotClassName: "bg-[var(--muted-foreground)]",
  },
}

function TechnologyChip({
  tech,
  chipClassName,
  dotClassName,
}: {
  tech: TechnologySection["buckets"][number]["items"][number]
  chipClassName: string
  dotClassName: string
}) {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div
          className={`flex items-center gap-2 rounded-lg border bg-[var(--surface-dark)] px-3 py-2 transition-all cursor-default hover:shadow-sm ${chipClassName}`}
        >
          <div className={`size-2 rounded-full ${dotClassName}`} />
          <span className="truncate text-sm text-[var(--foreground)]">{tech.name}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="flex w-72 flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-dark)]">
            {tech.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote Wappalyzer icons are rendered directly in hover cards
              <img
                src={tech.iconUrl}
                alt=""
                width={24}
                height={24}
                className="size-6 object-contain"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Layers className="size-4 text-[var(--muted-foreground)]" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-medium text-[var(--foreground)]">{tech.name}</span>
            {tech.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tech.categories.map((category) => (
                  <Badge key={`${tech.name}-${category}`} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-[var(--muted-foreground)]">No Wappalyzer category available</span>
            )}
          </div>
        </div>
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">
          {tech.description ?? "No Wappalyzer description available."}
        </p>
        {tech.website ? (
          <a
            href={tech.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
          >
            <ExternalLink className="size-3" />
            Official Site
          </a>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  )
}

// Technologies Section
export function TechnologiesSection({ technology }: { technology: TechnologySection }) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="mb-5 flex items-center gap-2">
          <Layers className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-lg">Technologies</span>
          <Badge variant="outline" className="ml-1">
            {technology.totalCount}
          </Badge>
        </div>

        <div className="flex flex-col gap-4">
          {technology.buckets.map((bucket) => {
            const presentation = technologyBucketPresentation[bucket.id]
            const BucketIcon = presentation.icon

            return (
              <div key={bucket.id} className={`rounded-xl p-4 ${presentation.panelClassName}`}>
                <div className="mb-4 flex items-center gap-2">
                  <div className={`rounded-lg p-1.5 ${presentation.iconClassName}`}>
                    <BucketIcon className="size-4" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--foreground)]">{bucket.label}</span>
                  <Badge variant="outline" className="text-xs">
                    {bucket.items.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bucket.items.map((tech) => (
                    <TechnologyChip
                      key={`${bucket.id}-${tech.name}`}
                      tech={tech}
                      chipClassName={presentation.chipClassName}
                      dotClassName={presentation.dotClassName}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {technology.cpeEntries.length > 0 && (
            <div className="rounded-xl border border-[var(--gray-border)]/10 bg-[var(--surface-mid)]/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <div className="rounded-lg bg-[var(--muted-foreground)]/10 p-1.5">
                  <Shield className="size-4 text-[var(--muted-foreground)]" />
                </div>
                <span className="text-sm font-semibold text-[var(--foreground)]">CPE Entries</span>
                <Badge variant="outline" className="text-xs">
                  {technology.cpeEntries.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {technology.cpeEntries.map((entry) => (
                  <div
                    key={entry.cpe}
                    className="flex flex-col gap-1 rounded-lg border border-[var(--gray-border)]/20 bg-[var(--surface-dark)] px-3 py-2"
                  >
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {entry.vendor && entry.product
                        ? `${entry.vendor} ${entry.product}`
                        : entry.vendor || entry.product || "Unknown Product"}
                    </span>
                    <code className="break-all font-mono text-xs text-[var(--muted-foreground)]">
                      {entry.cpe}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Technical Details Section
export function TechnicalDetailsSection({ delivery }: { delivery: DeliveryRedirectsSection }) {
  return (
    <CollapsibleSection title="Technical Details" icon={Database}>
      <div className="grid grid-cols-1 gap-5 text-base sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-1">Response Time</p>
          <p className="font-mono">{delivery.responseTimeMs}ms</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-1">Content Type</p>
          <p className="font-mono">{delivery.contentType ?? "N/A"}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-1">Content Length</p>
          <p className="font-mono">{delivery.contentLength.toLocaleString()} bytes</p>
        </div>
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-1">Method</p>
          <p className="font-mono">{delivery.method}</p>
        </div>
      </div>
    </CollapsibleSection>
  )
}

// DNS & Infrastructure Section Component
export function DnsInfrastructureCard({ dns }: { dns: DnsInfrastructureSection }) {
  const hasCname = dns.cname.length > 0
  const hasAsnRange = dns.asn.range && dns.asn.range.length > 0

  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: dns.capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: dns.capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: dns.capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: dns.capabilities.vhost },
  ]

  return (
    <CollapsibleSection title="DNS & Infrastructure" icon={Network}>
      <div className="space-y-5">
        {/* Capabilities */}
        <div className="flex flex-wrap gap-2">
          {capabilityItems.map((cap) => (
            <div
              key={cap.key}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${
                cap.enabled
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : "border-[var(--gray-border)]/20 bg-[var(--gray-charcoal)]/50 opacity-60"
              }`}
            >
              <span className="text-sm font-medium text-[var(--foreground)]">{cap.label}</span>
              {cap.enabled ? (
                <CheckCircle2 className="size-3.5 text-[var(--accent)]" />
              ) : (
                <XCircle className="size-3.5 text-[var(--muted-foreground)]" />
              )}
            </div>
          ))}
        </div>

        {/* DNS Records */}
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">DNS Records</p>
          <div className="grid grid-cols-1 gap-4 text-base md:grid-cols-3">
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">A Record</p>
              <p className="font-mono text-sm">{dns.a.join(", ") || dns.hostIp || "N/A"}</p>
            </div>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">AAAA Records</p>
              <p className="font-mono text-sm">{dns.aaaa.join(", ") || "N/A"}</p>
            </div>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">Resolvers</p>
              <p className="font-mono text-sm">{dns.resolvers.join(", ") || "N/A"}</p>
            </div>
          </div>
          {hasCname && (
            <div className="mt-3 p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">CNAME Records</p>
              <p className="font-mono text-sm">{dns.cname.join(", ")}</p>
            </div>
          )}
        </div>

        {/* ASN */}
        <div className="border-t border-[var(--gray-border)]/20 pt-5">
          <p className="text-sm text-[var(--muted-foreground)] mb-3">Network (ASN)</p>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0">
                {dns.asn.asNumber || "N/A"}
              </Badge>
              <span className="text-sm text-[var(--foreground)] break-all">{dns.asn.org || "Unknown organization"}</span>
            </div>
            {dns.asn.country && (
              <p className="text-sm text-[var(--muted-foreground)]">Country: {dns.asn.country}</p>
            )}
            {hasAsnRange && (
              <div className="mt-2 flex flex-wrap gap-1">
                {dns.asn.range!.map((r) => (
                  <Badge key={r} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs font-mono">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nameservers */}
        {dns.nameservers.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">Nameservers</p>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <div className="flex flex-wrap gap-2">
                {dns.nameservers.map((ns) => (
                  <Badge key={ns} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-sm font-mono px-2 py-1">
                    {ns}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DNS Services from Nuclei */}
        {dns.dnsServices.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">Detected DNS Services</p>
            <div className="space-y-2">
              {dns.dnsServices.map((service) => (
                <div key={`${service.serviceName}-${service.subject}`} className="flex items-center justify-between p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wifi className="size-4 text-[var(--accent)]" />
                    <span className="text-sm font-medium">{service.serviceName}</span>
                  </div>
                  <TargetContextBadge provenance={service.provenance} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TXT Records */}
        {dns.txtRecords.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-5">
            <p className="text-sm text-[var(--muted-foreground)] mb-3">TXT Records</p>
            <div className="space-y-2">
              {dns.txtRecords.map((txt) => (
                <div key={`${txt.subject}-${txt.records[0]?.slice(0, 20)}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--muted-foreground)]">{txt.subject}</span>
                    <TargetContextBadge provenance={txt.provenance} />
                  </div>
                  <div className="space-y-1">
                    {txt.records.map((record) => (
                      <p key={record.slice(0, 50)} className="font-mono text-sm break-all">{record}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function DetailRow({
  label,
  value,
  description,
}: {
  label: string
  value: string | null | undefined
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
        {label}
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-5 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label={`${label} explanation`}
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {description}
            </TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="text-right font-mono text-[var(--foreground)] break-all">{value || "N/A"}</span>
    </div>
  )
}

function IntelligenceSubtitle({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--gray-border)]/20 pb-2 pt-2">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">{label}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label={`${label} explanation`}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {description}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

type InternalCoHost = NetworkIntelligenceSection["internalMatches"][number]

function groupInternalCoHosts(matches: readonly InternalCoHost[]) {
  const groups = new Map<string, { key: string; target: string; title: string; matches: InternalCoHost[] }>()

  for (const match of matches) {
    const key = match.target.trim().toLowerCase()
    const existing = groups.get(key)

    if (existing) {
      existing.matches.push(match)
      if (!existing.title && match.title) {
        existing.title = match.title
      }
      continue
    }

    groups.set(key, {
      key,
      target: match.target,
      title: match.title,
      matches: [match],
    })
  }

  return [...groups.values()]
}

function getReverseDomainRows(domains: readonly string[]) {
  return domains.map((domain, index) => {
    const labels = domain.split(".").filter(Boolean)
    const baseDomain = labels.length > 1 ? labels.slice(-2).join(".") : domain
    const prefix = labels.length > 2 ? labels.slice(0, -2).join(".") : "@"

    return {
      id: `${domain}-${index}`,
      domain,
      baseDomain,
      prefix,
    }
  })
}

export function NetworkIntelligenceCard({ network }: { network: NetworkIntelligenceSection }) {
  const internalMatches = network.internalMatches
  const externalDomains = network.reverseIp.domains
  const coHostGroups = groupInternalCoHosts(internalMatches)
  const reverseDomainRows = getReverseDomainRows(externalDomains)
  const [expandedCoHostKeys, setExpandedCoHostKeys] = useState<Set<string>>(() => new Set())
  const cidr = network.rdap.cidrs[0] ?? network.bgp.prefix ?? null
  const hasErrors = Object.keys(network.errors).length > 0 || Boolean(network.reverseIp.error)

  function toggleCoHostGroup(key: string) {
    setExpandedCoHostKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  return (
    <CollapsibleSection title="IP Intelligence" icon={Network} badge={network.providerName ?? externalDomains.length}>
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
          <DetailRow label="IP" value={network.ip} />
          <DetailRow label="Provider" value={network.providerName ?? "Unknown"} />
          <DetailRow label="Source" value={network.providerSource?.toUpperCase() ?? null} />
          <DetailRow label="CIDR" value={cidr} />
        </div>

        <div className="space-y-2">
          <IntelligenceSubtitle
            label="RDAP"
            description="Registration Data Access Protocol data from the regional internet registry. Contact addresses here belong to the person or entity registered to the IP assignment and do not necessarily show the physical server location."
          />
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
            <DetailRow
              label="RDAP Registry"
              value={network.rdap.registry?.toUpperCase() ?? null}
              description="The registry inferred from the returned RDAP object itself, such as its port43 server or RDAP links. This is the best registry label for the specific assignment."
            />
            <DetailRow
              label="IANA Bootstrap Registry"
              value={network.rdap.bootstrapRegistry?.toUpperCase() ?? null}
              description="The registry IANA's RDAP bootstrap selected as the starting lookup endpoint for the broader address block. More-specific assignments can point to a different RDAP registry."
            />
            <DetailRow label="Network" value={network.rdap.name} />
            <DetailRow label="Handle" value={network.rdap.handle} />
            <DetailRow label="Parent Handle" value={network.rdap.parentHandle} />
            <DetailRow label="Type" value={network.rdap.type} />
            <DetailRow label="Status" value={network.rdap.status.join(", ") || null} />
            <DetailRow label="Country" value={network.rdap.country} />
            <DetailRow label="Range" value={network.rdap.startAddress && network.rdap.endAddress ? `${network.rdap.startAddress} - ${network.rdap.endAddress}` : null} />
            <DetailRow label="Lookup URL" value={network.rdap.queryUrl} />
            {network.rdap.fallbackFrom && <DetailRow label="Fallback From" value={network.rdap.fallbackFrom} />}
          </div>
        </div>

        {network.rdap.entities.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="RDAP Contacts"
              description="Registration contacts and entities attached to the RDAP assignment. Addresses identify registered contacts or organizations, not necessarily where the server hardware is located."
            />
            <div className="grid gap-2">
              {network.rdap.entities.map((entity, index) => (
                <div
                  key={`${entity.handle ?? entity.name ?? entity.organization ?? "entity"}-${index}`}
                  className="rounded-lg bg-[var(--surface-mid)]/20 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">{entity.name ?? entity.organization ?? entity.handle ?? "Unknown entity"}</span>
                    {entity.roles.map((role) => (
                      <Badge key={role} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                        {entity.relationship === "contact" ? role : `${role} ${entity.relationship}`}
                      </Badge>
                    ))}
                  </div>
                  {entity.organization && entity.organization !== entity.name && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{entity.organization}</p>
                  )}
                  {entity.handle && (
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{entity.handle}</p>
                  )}
                  {entity.address && (
                    <p className="mt-2 whitespace-pre-line font-mono text-xs text-[var(--foreground)]">{entity.address}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <IntelligenceSubtitle
            label="BGP Origin"
            description="Border Gateway Protocol origin data for the routed prefix currently announcing this IP. This is usually the strongest signal for the network operator or hosting provider."
          />
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
            <DetailRow label="ASN" value={network.bgp.asNumber} />
            <DetailRow label="Name" value={network.bgp.description} />
            <DetailRow label="Prefix" value={network.bgp.prefix} />
            <DetailRow label="Country" value={network.bgp.country} />
            <DetailRow label="Registry" value={network.bgp.registry?.toUpperCase() ?? null} />
            <DetailRow label="Allocated" value={network.bgp.allocatedAt} />
            <DetailRow label="Source" value={network.bgp.source} />
          </div>
        </div>

        {network.ptr.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="PTR"
              description="Reverse DNS pointer records returned by DNS for the IP address. PTR names are useful context, but they are operator-controlled and can be stale or misleading."
            />
            <div className="flex flex-wrap gap-1.5">
              {network.ptr.map((ptr) => (
                <Badge key={ptr} variant="outline" className="border-[var(--gray-border)] text-[var(--foreground)] font-mono text-xs">
                  {ptr}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {coHostGroups.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label="Stackray Co-hosts"
              description="Other scans in this Stackray database that resolved to the same host IP. This is local intelligence from your own scan history, not a third-party dataset."
            />
            <div className="space-y-2">
              {coHostGroups.map((group) => (
                <div key={group.key} className="rounded-lg bg-[var(--surface-mid)]/20 text-sm">
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <Link href={`/scans/${group.matches[0]?.scanId ?? ""}`} className="font-medium text-[var(--foreground)] hover:text-[var(--accent)] break-all">
                        {group.target}
                      </Link>
                      {group.title && <span className="block text-xs text-[var(--muted-foreground)] truncate">{group.title}</span>}
                    </div>
                    {group.matches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCoHostGroup(group.key)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--gray-border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                        aria-expanded={expandedCoHostKeys.has(group.key)}
                      >
                        {group.matches.length} scans
                        {expandedCoHostKeys.has(group.key) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    ) : null}
                  </div>
                  {group.matches.length > 1 && expandedCoHostKeys.has(group.key) && (
                    <div className="border-t border-[var(--gray-border)]/20 px-3 pb-3 pt-2">
                      <div className="space-y-1.5">
                        {group.matches.map((match) => (
                          <Link
                            key={`${match.scanId}-${match.resultId}`}
                            href={`/scans/${match.scanId}`}
                            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-[var(--surface-mid)]/35"
                          >
                            <span className="truncate text-[var(--muted-foreground)]">{match.title || match.finalUrl || match.target}</span>
                            <LocalTime value={match.observedAt} preset="shortDateTimeWithZone" className="font-mono text-[var(--foreground)]" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {externalDomains.length > 0 && (
          <div className="space-y-2">
            <IntelligenceSubtitle
              label={`External Reverse IP${network.reverseIp.provider ? ` (${network.reverseIp.provider})` : ""}`}
              description="Hostnames from a public reverse-IP dataset that have been observed on this IP. This is passive OSINT and can be incomplete, rate-limited, or stale."
            />
            <div className="overflow-x-auto rounded-lg border border-[var(--gray-border)]/20">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-[var(--surface-mid)]/25 text-[var(--muted-foreground)]">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">#</th>
                    <th scope="col" className="px-3 py-2 font-medium">Hostname</th>
                    <th scope="col" className="px-3 py-2 font-medium">Base Domain</th>
                    <th scope="col" className="px-3 py-2 font-medium">Prefix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--gray-border)]/10">
                  {reverseDomainRows.map((row, index) => (
                    <tr key={row.id} className="bg-[var(--surface-mid)]/10">
                      <td className="px-3 py-2 font-mono text-[var(--muted-foreground)]">{index + 1}</td>
                      <td className="px-3 py-2 font-mono text-[var(--foreground)] break-all">{row.domain}</td>
                      <td className="px-3 py-2 font-mono text-[var(--foreground)]">{row.baseDomain}</td>
                      <td className="px-3 py-2 font-mono text-[var(--muted-foreground)] break-all">{row.prefix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 space-y-2">
              <DetailRow label="Source URL" value={network.reverseIp.sourceUrl} />
              {network.reverseIp.fallbackFrom && <DetailRow label="Fallback From" value={network.reverseIp.fallbackFrom} />}
            </div>
          </div>
        )}

        {hasErrors && (
          <p className="text-xs text-amber-300">
            Some IP intelligence sources returned partial data. Raw errors are retained in the enrichment record.
          </p>
        )}

        {network.refreshedAt && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Updated <LocalTime value={network.refreshedAt} preset="shortDateTimeWithZone" />
          </p>
        )}
      </div>
    </CollapsibleSection>
  )
}

const SUBDOMAIN_PAGE_SIZE = 250

export function SubdomainsSectionCard({ scanId, subdomains }: { scanId: string; subdomains: SubdomainsSection }) {
  const { summary } = subdomains
  const [items, setItems] = useState(subdomains.items)
  const [total, setTotal] = useState(subdomains.total)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const statusLabel = summary.state === "not_run" ? "Not run" : summary.state
  const hasMore = items.length < total

  useEffect(() => {
    setItems(subdomains.items)
    setTotal(subdomains.total)
    setPage(1)
    setLoadError(null)
  }, [scanId, subdomains.items, subdomains.total])

  async function loadMoreSubdomains() {
    if (loadingMore || !hasMore) {
      return
    }

    const nextPage = page + 1
    setLoadingMore(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(SUBDOMAIN_PAGE_SIZE),
      })
      const response = await fetch(`/api/v1/scans/${scanId}/subdomains?${params}`)

      if (!response.ok) {
        throw new Error("Unable to load more subdomains.")
      }

      const payload = await response.json() as {
        items?: ScanSubdomainItem[]
        total?: number
      }

      setItems((currentItems) => {
        const seen = new Set(currentItems.map((item) => item.subdomainId))
        const nextItems = (payload.items ?? []).filter((item) => {
          if (seen.has(item.subdomainId)) {
            return false
          }

          seen.add(item.subdomainId)
          return true
        })

        return [...currentItems, ...nextItems]
      })
      setTotal(typeof payload.total === "number" ? payload.total : total)
      setPage(nextPage)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load more subdomains.")
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <CollapsibleSection title="Subdomains" icon={Globe2} badge={summary.resultCount}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 text-base md:grid-cols-3">
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Discovery Status</p>
            <p className="font-mono text-sm capitalize">{statusLabel}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Apex Domain</p>
            <p className="break-all font-mono text-sm">{summary.targetDomain ?? "N/A"}</p>
          </div>
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3">
            <p className="mb-1 text-sm text-[var(--muted-foreground)]">Validated Hosts</p>
            <p className="font-mono text-sm">{summary.resultCount.toLocaleString()}</p>
          </div>
        </div>

        {summary.errorMessage ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            {summary.errorMessage}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/20">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/20 px-3 py-2 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              <span>Host</span>
              <span>IP</span>
              <span>Source</span>
            </div>
            <div className="divide-y divide-[var(--gray-border)]/15">
              {items.map((item) => (
                <div
                  key={item.subdomainId}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.5fr)] gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 break-all font-mono text-[var(--foreground)]">{item.host}</span>
                  <span className="min-w-0 break-all font-mono text-[var(--muted-foreground)]">{item.ip ?? "N/A"}</span>
                  <span className="min-w-0 truncate text-[var(--muted-foreground)]">{item.source ?? "unknown"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-[var(--surface-mid)]/20 p-3 text-sm text-[var(--muted-foreground)]">
            No validated subdomains found.
          </div>
        )}

        {total > items.length ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            Showing {items.length} of {total.toLocaleString()} validated subdomains.
          </p>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
            {loadError}
          </div>
        ) : null}

        {hasMore ? (
          <button
            type="button"
            onClick={loadMoreSubdomains}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/30 bg-[var(--surface-mid)]/30 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--surface-mid)]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="size-4" />
            {loadingMore ? "Loading" : "Load more"}
          </button>
        ) : null}
      </div>
    </CollapsibleSection>
  )
}

// TLS Certificate Section
export function TlsCertificateSection({ tls }: { tls: TlsFingerprintsSection }) {
  const cert = tls.certificate

  const getCertField = (field: string): string | undefined => {
    const value = cert?.[field]
    if (typeof value === "string") return value
    return undefined
  }

  const getCertArray = (field: string): string[] => {
    const value = cert?.[field]
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string")
    }
    return []
  }

  return (
    <CollapsibleSection title="TLS Certificate" icon={Lock}>
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2 md:grid-cols-3">
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">SNI</p>
            <p className="font-mono text-sm">{tls.sni ?? "N/A"}</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">JARM Hash</p>
            <p className="font-mono text-xs break-all">{tls.jarmHash ?? "N/A"}</p>
          </div>
          {getCertField("tls_version") && (
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--muted-foreground)] mb-1">TLS Version</p>
              <p className="font-mono text-sm">{getCertField("tls_version")}</p>
            </div>
          )}
        </div>

        {/* Certificate Details */}
        {cert && Object.keys(cert).length > 0 && (
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg space-y-3">
            {getCertField("subject") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Subject</p>
                <p className="font-mono text-sm break-all">{getCertField("subject")}</p>
              </div>
            )}
            {getCertField("issuer") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Issuer</p>
                <p className="font-mono text-sm break-all">{getCertField("issuer")}</p>
              </div>
            )}
            {getCertField("serial") && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Serial</p>
                <p className="font-mono text-xs break-all">{getCertField("serial")}</p>
              </div>
            )}
            {(getCertField("not_before") || getCertField("not_after")) && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Validity</p>
                <div className="font-mono text-sm">
                  {getCertField("not_before") && <span className="block">From: {getCertField("not_before")}</span>}
                  {getCertField("not_after") && <span className="block">Until: {getCertField("not_after")}</span>}
                </div>
              </div>
            )}
            {getCertArray("subject_alt_name").length > 0 && (
              <div>
                <p className="text-sm text-[var(--muted-foreground)] mb-1">Subject Alt Names</p>
                <div className="flex flex-wrap gap-1">
                  {getCertArray("subject_alt_name").map((san) => (
                    <Badge key={san} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                      {san}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SSL Findings from Nuclei */}
        {tls.sslDnsNames.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">SSL DNS Names (Nuclei)</p>
            <div className="space-y-2">
              {tls.sslDnsNames.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.subjectAltNames[0]}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <div className="flex flex-wrap gap-1">
                    {finding.subjectAltNames.map((san) => (
                      <Badge key={san} variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                        {san}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tls.sslIssuers.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">SSL Issuers (Nuclei)</p>
            <div className="space-y-2">
              {tls.sslIssuers.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.issuer}`} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="font-mono text-sm">{finding.issuer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

function isAbsoluteHttpUrl(value: string | null | undefined): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value)
}

function isLocalImagePath(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("/")
}

// Fingerprints Section
export function FingerprintsSection({ tls }: { tls: TlsFingerprintsSection }) {
  const hashEntries = Object.entries(tls.hashes).filter(([, value]) => value && value !== "N/A")
  const faviconPreviewSrc = resolveFaviconPreviewSrc(tls.favicon)
  const faviconDisplayValue = faviconPreviewSrc ?? tls.favicon.path ?? tls.favicon.url

  return (
    <CollapsibleSection title="Fingerprints" icon={Fingerprint}>
      <div className="space-y-4">
        {/* Favicon */}
        {faviconDisplayValue && (
          <div className="flex items-center gap-5">
            <div className="size-20 bg-[var(--surface-mid)] rounded-lg flex items-center justify-center overflow-hidden">
              {faviconPreviewSrc ? (
                isLocalImagePath(faviconPreviewSrc) ? (
                  <Image
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={56}
                    height={56}
                    className="object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
                  <img
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={56}
                    height={56}
                    className="object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                )
              ) : (
                <span className="font-mono text-xs text-[var(--muted-foreground)]">No preview</span>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-[var(--muted-foreground)] mb-2">Favicon URL</p>
              <p className="font-mono text-sm break-all">{faviconDisplayValue}</p>
            </div>
          </div>
        )}

        {/* Favicon Hashes */}
        <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Favicon MMH3</p>
            <p className="font-mono text-sm break-all">{tls.favicon.mmh3 ?? "N/A"}</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Favicon MD5</p>
            <p className="font-mono text-sm break-all">{tls.favicon.md5 ?? "N/A"}</p>
          </div>
        </div>

        {/* Content Hashes */}
        {hashEntries.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-4">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Content Hashes</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {hashEntries.map(([hashType, hashValue]) => (
                <div key={hashType} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                  <p className="text-sm text-[var(--muted-foreground)] mb-1 uppercase">{hashType}</p>
                  <p className="font-mono text-xs break-all">{hashValue}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// Domain Info Section
export function DomainInfoSection({ domain }: { domain: DomainIntelligenceSection }) {
  if (domain.metadata.length === 0) {
    return (
      <CollapsibleSection title="Domain Info" icon={FileText}>
        <p className="text-[var(--muted-foreground)]">No domain metadata available</p>
      </CollapsibleSection>
    )
  }

  return (
    <CollapsibleSection title="Domain Info" icon={FileText}>
      <div className="space-y-4">
        {domain.metadata.map((metadata) => (
          <DomainMetadataCard key={metadata.subject} metadata={metadata} />
        ))}
      </div>
    </CollapsibleSection>
  )
}

function DomainMetadataCard({ metadata }: { metadata: DomainMetadata }) {
  return (
    <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg border border-[var(--gray-border)]/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-[var(--accent)]" />
          <span className="font-mono text-sm">{metadata.subject}</span>
        </div>
        <TargetContextBadge provenance={metadata.provenance} />
      </div>

      <div className="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
        {metadata.registrarName && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar</p>
            <p className="font-medium">{metadata.registrarName}</p>
            {metadata.registrarIanaId && (
              <p className="text-xs text-[var(--muted-foreground)] font-mono">IANA ID: {metadata.registrarIanaId}</p>
            )}
          </div>
        )}
        {metadata.registrarUrl && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar URL</p>
            <a
              href={metadata.registrarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent)] break-all hover:underline"
            >
              {metadata.registrarUrl}
            </a>
          </div>
        )}
        {metadata.registrarEmail && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Email</p>
            <p className="font-mono text-sm break-all">{metadata.registrarEmail}</p>
          </div>
        )}
        {metadata.registrarPhone && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registrar Phone</p>
            <p className="font-mono text-sm break-all">{metadata.registrarPhone}</p>
          </div>
        )}
        {metadata.registrationDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Registration Date</p>
            <p className="font-mono text-sm">{metadata.registrationDate}</p>
          </div>
        )}
        {metadata.expirationDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Expiration Date</p>
            <p className="font-mono text-sm">{metadata.expirationDate}</p>
          </div>
        )}
        {metadata.lastChangedDate && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Last Changed</p>
            <p className="font-mono text-sm">{metadata.lastChangedDate}</p>
          </div>
        )}
        {metadata.dnssec && (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">DNSSEC</p>
            <p className={metadata.dnssec === "true" ? "text-emerald-400" : "text-orange-400"}>
              {metadata.dnssec === "true" ? "Enabled" : "Disabled"}
            </p>
          </div>
        )}
      </div>

      {metadata.nameservers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--gray-border)]/20">
          <p className="text-sm text-[var(--muted-foreground)] mb-2">Nameservers</p>
          <div className="flex flex-wrap gap-2">
            {metadata.nameservers.map((ns) => (
              <Badge key={ns} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-sm font-mono px-2 py-1">
                {ns}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {metadata.status.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {metadata.status.map((s) => (
            <Badge key={s} variant="outline" className="border-[var(--gray-border)]/30 text-[var(--muted-foreground)] text-xs">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function ContentSignalsSectionCard({ content }: { content: ContentSignalsSection }) {
  return (
    <CollapsibleSection title="Content Signals" icon={Eye}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Content Length</p>
            <p className="font-mono text-sm">{content.contentLength.toLocaleString()} bytes</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Domains in Body</p>
            <p className="font-mono text-sm">{content.bodyDomains.length}</p>
          </div>
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-1">FQDNs in Body</p>
            <p className="font-mono text-sm">{content.bodyFqdns.length}</p>
          </div>
        </div>

        {content.bodyPreview ? (
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Body Preview</p>
            <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
              <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words line-clamp-6">
                {content.bodyPreview}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg text-sm text-[var(--muted-foreground)]">
            No body preview available.
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

// Robots.txt Section
export function RobotsTxtSection({ content }: { content: ContentSignalsSection }) {
  const { robotsTxt } = content

  return (
    <CollapsibleSection title="Robots.txt" icon={FileText}>
      {robotsTxt ? (
        <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span className="text-emerald-400">Robots.txt found</span>
          </div>
          {robotsTxt.matchedAt && (
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Matched at: {robotsTxt.matchedAt}</p>
          )}
          {robotsTxt.extractedResults.length > 0 && (
            <div className="space-y-1">
              {robotsTxt.extractedResults.map((result) => (
                <p key={result.slice(0, 50)} className="font-mono text-sm text-[var(--muted-foreground)]">
                  {result}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg">
          <div className="flex items-center gap-2">
            <MinusCircle className="size-4 text-[var(--muted-foreground)]" />
            <span className="text-[var(--muted-foreground)]">No robots.txt detected</span>
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}

// Screenshot Preview Card
export function ScreenshotPreviewCard({ content, target }: { content: ContentSignalsSection; target: string }) {
  const { screenshot } = content
  const formattedSize = screenshot.byteSize
    ? screenshot.byteSize < 1024
      ? `${screenshot.byteSize} B`
      : screenshot.byteSize < 1024 * 1024
        ? `${Math.round(screenshot.byteSize / 1024)} KB`
        : `${(screenshot.byteSize / (1024 * 1024)).toFixed(1)} MB`
    : null

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-base">Homepage Screenshot</span>
        </div>
        <div className="bg-[var(--surface-mid)] rounded-lg overflow-hidden border border-[var(--gray-border)]/20">
          {screenshot.available && screenshot.path ? (
            <>
              <div className="relative h-56">
                <Image
                  src={screenshot.path}
                  alt={`Homepage screenshot for ${target}`}
                  fill
                  unoptimized
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3 border-t border-[var(--gray-border)]/20">
                <div className="flex items-center justify-between text-sm">
                  {formattedSize ? <span className="text-[var(--muted-foreground)]">{formattedSize}</span> : null}
                  {screenshot.capturedAt && (
                    <span className="text-[var(--muted-foreground)]">
                      <LocalTime value={screenshot.capturedAt} preset="fullDateTimeWithZone" />
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-56 bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)] flex items-center justify-center">
              <div className="text-center">
                <Globe className="size-16 text-[var(--muted-foreground)] mx-auto mb-3" />
                <p className="text-base text-[var(--muted-foreground)]">Screenshot not available</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Redirect Chain Card
export function RedirectChainCard({ delivery }: { delivery: DeliveryRedirectsSection }) {
  const hasRedirects = delivery.redirectChain.items.length > 1

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-base">Redirect Chain</span>
        </div>
        {hasRedirects ? (
          <div className="flex flex-col items-center">
            {delivery.redirectChain.items.map((hop, hopIdx) => {
              const statusCode = hop.statusCode ?? delivery.redirectChain.statusCodes[hopIdx]
              return (
                <div key={`${hop.url}-${statusCode}`} className="w-full">
                  <div className="flex items-center gap-2 p-2 bg-[var(--surface-mid)]/20 rounded border border-[var(--gray-border)]/30">
                    <span
                      className={`font-mono text-sm shrink-0 ${
                        statusCode === 200 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {statusCode}
                    </span>
                    <span className="text-sm font-mono truncate text-[var(--foreground)]">{hop.url}</span>
                  </div>
                  {hopIdx < delivery.redirectChain.items.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-[var(--accent)]/50" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <CheckCircle2 className="size-4" />
            <span>No redirects, direct response</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Body Domains Card
export function BodyDomainsCard({ content }: { content: ContentSignalsSection }) {
  const [viewAll, setViewAll] = useState(false)
  const totalDomains = content.bodyDomains.length + content.bodyFqdns.length

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Globe2 className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-base">Body Domains</span>
          <Badge variant="outline" className="ml-auto text-sm">
            {totalDomains}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(viewAll ? content.bodyDomains : content.bodyDomains.slice(0, 12)).map((domain) => (
            <Badge key={domain} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--muted-foreground)] text-sm">
              {domain}
            </Badge>
          ))}
        </div>
        {content.bodyFqdns.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--gray-border)]/20">
            <p className="text-xs text-[var(--muted-foreground)] mb-2">FQDNs</p>
            <div className="flex flex-wrap gap-2">
              {(viewAll ? content.bodyFqdns : content.bodyFqdns.slice(0, 8)).map((fqdn) => (
                <Badge key={fqdn} variant="outline" className="border-[var(--gray-border)]/50 text-[var(--muted-foreground)] text-xs font-mono">
                  {fqdn}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {totalDomains > 12 && (
          <button
            type="button"
            onClick={() => setViewAll(!viewAll)}
            className="text-sm text-[var(--accent)] hover:underline flex items-center gap-1 mt-3"
          >
            {viewAll ? "View less" : `View all ${totalDomains} domains`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// History Card
export function HistoryCard({ history }: { history: HistorySection }) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="size-4 text-emerald-400" />
      case "failed":
        return <XCircle className="size-4 text-red-400" />
      case "cancelled":
        return <MinusCircle className="size-4 text-amber-400" />
      default:
        return <Clock className="size-4 text-[var(--muted-foreground)]" />
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "border-emerald-400/30 text-emerald-400 bg-emerald-400/10"
      case "failed":
        return "border-red-400/30 text-red-400 bg-red-400/10"
      case "cancelled":
        return "border-amber-400/30 text-amber-400 bg-amber-400/10"
      default:
        return "border-[var(--gray-border)] text-[var(--muted-foreground)]"
    }
  }

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="size-5 text-[var(--accent)]" />
            <span className="font-semibold text-base">Previous Scans</span>
          </div>
          <Badge variant="outline" className="text-sm">
            {history.items.length}
          </Badge>
        </div>
        <div className="space-y-2">
          {history.items.map((item) => (
            <Link key={item.scanId} href={`/scans/${item.scanId}`} className="block">
              <div className="p-3 rounded-lg border border-[var(--gray-border)]/20 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-mid)]/20 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(item.status)}
                    <span className="font-mono text-sm text-[var(--foreground)] truncate">
                      <LocalTime value={item.completedAt} preset="shortDateTimeWithZone" />
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-xs px-2 py-0.5 shrink-0 ${getStatusBadgeClass(item.status)}`}>
                    {item.status}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--foreground)] font-medium line-clamp-1 mb-2">
                  {item.title || "Untitled"}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                  <Layers className="size-3.5" />
                  <span>{item.technologies.length} technologies</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Scan Info Card
export function ScanInfoCard({
  source,
  submittedAt,
  completedAt,
  asnNumber,
}: {
  source: string
  submittedAt: string
  completedAt: string | null
  asnNumber: string | null
}) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Info className="size-5 text-[var(--accent)]" />
          <span className="font-semibold text-base">Scan Info</span>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Source</span>
            <span className="font-mono">{source}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Submitted</span>
            <span className="font-mono">
              <LocalTime value={submittedAt} preset="shortDateTimeWithZone" />
            </span>
          </div>
          {completedAt && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Completed</span>
              <span className="font-mono">
                <LocalTime value={completedAt} preset="shortDateTimeWithZone" />
              </span>
            </div>
          )}
          {asnNumber && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">ASN</span>
              <span className="font-mono">{asnNumber}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function QuickActionsCard({ target, scheduleSeed }: { target: string; scheduleSeed?: CreateScheduleSeed }) {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
            onClick={() => setScheduleDialogOpen(true)}
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <CalendarClock className="size-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Schedule</span>
          </button>
          <button
            type="button"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <RefreshCw className="size-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Rescan</span>
          </button>
          <a
            href={target.startsWith("http") ? target : `https://${target}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer no-underline"
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <ExternalLink className="size-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Open Site</span>
          </a>
          <a
            href="#raw-evidence"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer no-underline"
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <Fingerprint className="size-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Raw Data</span>
          </a>
        </div>
      </CardContent>

      <CreateScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        seed={scheduleSeed}
      />
    </Card>
  )
}

// Raw Evidence Section Component
export function RawEvidenceCard({ rawEvidence, scanId, target }: { rawEvidence: RawEvidenceSection; scanId: string; target: string }) {
  return (
    <div id="raw-evidence">
      <RawEvidenceTabs
        rawHttpx={rawEvidence.rawHttpx}
        nuclei={rawEvidence.nuclei}
        scanId={scanId}
        target={target}
      />
    </div>
  )
}
