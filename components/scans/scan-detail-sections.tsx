"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Minus,
  XCircle,
  Zap,
  CheckCircle,
  MinusCircle,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import type {
  OverviewSection,
  TechnologySection,
  DeliveryRedirectsSection,
  DnsInfrastructureSection,
  TlsFingerprintsSection,
  DomainIntelligenceSection,
  ContentSignalsSection,
  RawEvidenceSection,
  HistorySection,
  DomainMetadata,
  DomainProvenance,
} from "@/lib/server/scans/scan-detail-view-model"
import type { NucleiSchema } from "@/lib/contracts/scans"
import { RawEvidenceTabs } from "./raw-evidence-tabs"

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
        <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
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
  defaultOpen = false,
  badge,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string | number
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-[var(--gray-border)]/30 rounded-lg overflow-hidden bg-[var(--surface-dark)]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[var(--surface-dark)] hover:bg-[var(--surface-mid)]/20 transition-colors border-b border-transparent data-[state=open]:border-[var(--gray-border)]/20"
        data-state={isOpen ? "open" : "closed"}
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-[var(--accent)]" />
          <span className="font-semibold text-lg">{title}</span>
          {badge && (
            <Badge variant="outline" className="text-sm ml-2">
              {badge}
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
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

// Nuclei State Badge
function NucleiStateBadge({ state }: { state: NucleiSchema["state"] }) {
  const stateConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    not_run: { label: "Not Run", icon: <MinusCircle className="w-3.5 h-3.5" />, className: "border-[var(--gray-border)] text-[var(--muted-foreground)]" },
    pending: { label: "Pending", icon: <Clock className="w-3.5 h-3.5" />, className: "border-amber-400/30 text-amber-400" },
    running: { label: "Running", icon: <Zap className="w-3.5 h-3.5" />, className: "border-[var(--accent)]/30 text-[var(--accent)]" },
    completed: { label: "Completed", icon: <CheckCircle className="w-3.5 h-3.5" />, className: "border-emerald-400/30 text-emerald-400" },
    failed: { label: "Failed", icon: <XCircle className="w-3.5 h-3.5" />, className: "border-red-400/30 text-red-400" },
    skipped: { label: "Skipped", icon: <Minus className="w-3.5 h-3.5" />, className: "border-[var(--gray-border)] text-[var(--muted-foreground)]" },
  }

  const config = stateConfig[state] || stateConfig.not_run

  return (
    <Badge variant="outline" className={`text-sm ${config.className}`}>
      <span className="flex items-center gap-1.5">
        {config.icon}
        {config.label}
      </span>
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
}: {
  scanId: string
  target: string
  status: "completed" | "running" | "failed" | "cancelled"
  source: string
  submittedAt: string
  currentAttempt: { attemptNumber: number; requestProfile: string; fallbackReason: string | null } | null
  attemptHistory: Array<{ attemptNumber: number; status: string; requestProfile: string; fallbackReason: string | null }>
}) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{target.replace(/^https?:\/\//, "")}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-[var(--muted-foreground)] flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {source}
                </span>
                <span className="text-[var(--gray-border)]">|</span>
                <span className="font-mono text-xs">{scanId}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status !== "completed" && (
                <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] px-3 py-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse mr-1.5" />
                  {status}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-3 border-t border-[var(--gray-border)]/20 text-sm">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <CalendarDays className="w-4 h-4" />
              <span>
                Submitted{" "}
                {new Date(submittedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      <CompactKPI icon={Server} label="Server" value={overview.server ?? "Unknown"} subValue={overview.cdnName} />
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
                <div className="shrink-0 w-8 h-8 bg-[var(--surface-mid)] rounded overflow-hidden flex items-center justify-center">
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

// Technologies Section
export function TechnologiesSection({ technology }: { technology: TechnologySection }) {
  const [techExpanded, setTechExpanded] = useState(false)

  const primaryCount = technology.primary.length
  const additionalCount = technology.additional.length
  const wordpressCount = technology.wordpress.plugins.length + technology.wordpress.themes.length

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--accent)]" />
            <span className="font-semibold text-lg">Technologies</span>
            <Badge variant="outline" className="ml-1">
              {technology.totalCount}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => setTechExpanded(!techExpanded)}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            {techExpanded ? "Collapse" : "Expand all"}
          </button>
        </div>

        {/* Primary Technologies */}
        {primaryCount > 0 && (
          <div className="mb-6 bg-[var(--accent)]/5 border border-[var(--accent)]/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[var(--accent)]/20 rounded-lg">
                <Star className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">Primary Stack</span>
              <Badge variant="outline" className="text-xs border-[var(--accent)]/30">
                {primaryCount}
              </Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {technology.primary.map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-center gap-2 px-3 py-2.5 bg-[var(--surface-dark)] border border-[var(--accent)]/20 rounded-lg hover:border-[var(--accent)]/50 hover:shadow-sm transition-all cursor-default"
                >
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_6px_rgba(0,0,0,0.3)]" />
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">{tech.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WordPress Plugins */}
        {wordpressCount > 0 && (
          <div className="mb-6 bg-[var(--surface-mid)]/20 border border-[var(--gray-border)]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-purple-500/20 rounded-lg">
                <Puzzle className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">WordPress Ecosystem</span>
              <Badge variant="outline" className="text-xs">
                {wordpressCount}
              </Badge>
            </div>
            {technology.wordpress.plugins.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-[var(--muted-foreground)] mb-2">Plugins</p>
                <div className="flex flex-wrap gap-2">
                  {technology.wordpress.plugins.map((plugin) => (
                    <div
                      key={plugin.name}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/50 rounded-lg hover:border-purple-400/50 hover:shadow-sm transition-all cursor-default"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="text-sm text-[var(--foreground)] truncate">{plugin.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {technology.wordpress.themes.length > 0 && (
              <div>
                <p className="text-xs text-[var(--muted-foreground)] mb-2">Themes</p>
                <div className="flex flex-wrap gap-2">
                  {technology.wordpress.themes.map((theme) => (
                    <div
                      key={theme.name}
                      className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/50 rounded-lg hover:border-purple-400/50 hover:shadow-sm transition-all cursor-default"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                      <span className="text-sm text-[var(--foreground)] truncate">{theme.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Additional Technologies */}
        {additionalCount > 0 && (
          <div className="bg-[var(--surface-mid)]/10 border border-[var(--gray-border)]/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[var(--muted-foreground)]/20 rounded-lg">
                <Plus className="w-4 h-4 text-[var(--muted-foreground)]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">Additional Detected</span>
              <Badge variant="outline" className="text-xs">
                {additionalCount}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {(techExpanded ? technology.additional : technology.additional.slice(0, 12)).map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--gray-border)]/30 rounded-lg hover:border-[var(--accent)]/30 hover:shadow-sm transition-all cursor-default"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--muted-foreground)]" />
                  <span className="text-sm text-[var(--muted-foreground)] truncate">{tech.name}</span>
                </div>
              ))}
              {!techExpanded && additionalCount > 12 && (
                <button
                  type="button"
                  onClick={() => setTechExpanded(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-dark)] border border-dashed border-[var(--accent)]/40 rounded-lg hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all"
                >
                  <Plus className="w-3 h-3 text-[var(--accent)]" />
                  <span className="text-sm text-[var(--accent)] font-medium">+{additionalCount - 12} more</span>
                </button>
              )}
            </div>
          </div>
        )}

        {technology.cpeEntries.length > 0 && (
          <div className="bg-[var(--surface-mid)]/5 border border-[var(--gray-border)]/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[var(--muted-foreground)]/10 rounded-lg">
                <Shield className="w-4 h-4 text-[var(--muted-foreground)]" />
              </div>
              <span className="text-sm font-semibold text-[var(--foreground)]">CPE Entries</span>
              <Badge variant="outline" className="text-xs">
                {technology.cpeEntries.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {technology.cpeEntries.map((entry) => (
                <div
                  key={entry.cpe}
                  className="flex flex-col gap-1 bg-[var(--surface-dark)] border border-[var(--gray-border)]/20 rounded-lg px-3 py-2"
                >
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {entry.vendor && entry.product
                      ? `${entry.vendor} ${entry.product}`
                      : entry.vendor || entry.product || "Unknown Product"}
                  </span>
                  <code className="text-xs text-[var(--muted-foreground)] font-mono break-all">
                    {entry.cpe}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Technical Details Section
export function TechnicalDetailsSection({ delivery }: { delivery: DeliveryRedirectsSection }) {
  return (
    <CollapsibleSection title="Technical Details" icon={Database}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 text-base">
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
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
              )}
            </div>
          ))}
        </div>

        {/* DNS Records */}
        <div>
          <p className="text-sm text-[var(--muted-foreground)] mb-3">DNS Records</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-base">
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
                    <Wifi className="w-4 h-4 text-[var(--accent)]" />
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
    <CollapsibleSection title="TLS Certificate" icon={Lock} defaultOpen={true}>
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-base">
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
            <div className="w-20 h-20 bg-[var(--surface-mid)] rounded-lg flex items-center justify-center overflow-hidden">
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
        <div className="grid grid-cols-2 gap-4 text-base">
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
    <CollapsibleSection title="Domain Info" icon={FileText} defaultOpen={true}>
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
          <Globe className="w-4 h-4 text-[var(--accent)]" />
          <span className="font-mono text-sm">{metadata.subject}</span>
        </div>
        <TargetContextBadge provenance={metadata.provenance} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-base">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
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
            <MinusCircle className="w-4 h-4 text-[var(--muted-foreground)]" />
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
          <Eye className="w-5 h-5 text-[var(--accent)]" />
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
                  className="object-cover"
                />
              </div>
              <div className="p-3 border-t border-[var(--gray-border)]/20">
                <div className="flex items-center justify-between text-sm">
                  {formattedSize && <span className="text-[var(--muted-foreground)]">{formattedSize}</span>}
                  {screenshot.capturedAt && (
                    <span className="text-[var(--muted-foreground)]">
                      {new Date(screenshot.capturedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="h-56 bg-gradient-to-br from-[var(--surface-mid)] to-[var(--surface-dark)] flex items-center justify-center">
              <div className="text-center">
                <Globe className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-3" />
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
          <LinkIcon className="w-5 h-5 text-[var(--accent)]" />
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
            <CheckCircle2 className="w-4 h-4" />
            <span>No redirects — direct response</span>
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
          <Globe2 className="w-5 h-5 text-[var(--accent)]" />
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
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />
      case "cancelled":
        return <MinusCircle className="w-4 h-4 text-amber-400" />
      default:
        return <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
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
            <History className="w-5 h-5 text-[var(--accent)]" />
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
                      {formatDate(item.completedAt)} {formatTime(item.completedAt)}
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
                  <Layers className="w-3.5 h-3.5" />
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
          <Info className="w-5 h-5 text-[var(--accent)]" />
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
              {new Date(submittedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>
          {completedAt && (
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Completed</span>
              <span className="font-mono">
                {new Date(completedAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
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

export function QuickActionsCard({ target }: { target: string }) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer"
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
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
              <ExternalLink className="w-3.5 h-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Open Site</span>
          </a>
          <a
            href="#raw-evidence"
            className="group flex flex-col items-center gap-2 py-3 px-2 rounded-lg border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/10 hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/8 transition-all duration-150 cursor-pointer no-underline"
          >
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10 group-hover:bg-[var(--accent)]/20 transition-colors">
              <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-medium text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">Raw Data</span>
          </a>
        </div>
      </CardContent>
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

// Nuclei Findings Section
export function NucleiFindingsSection({ nuclei }: { nuclei: NucleiSchema }) {
  const findingsByKind = new Map<string, typeof nuclei.findings>()

  for (const finding of nuclei.findings) {
    const kind = finding.findingKind
    if (!findingsByKind.has(kind)) {
      findingsByKind.set(kind, [])
    }
    findingsByKind.get(kind)!.push(finding)
  }

  const kindLabels: Record<string, string> = {
    domain_metadata: "Domain Metadata",
    dns_service: "DNS Services",
    ssl_dns_names: "SSL DNS Names",
    ssl_issuer: "SSL Issuer",
    txt_record: "TXT Records",
    nameserver_record: "Nameserver Records",
    robots_txt: "Robots.txt",
    technology_match: "Technology Matches",
  }

  return (
    <CollapsibleSection
      title="Nuclei Security Findings"
      icon={Shield}
      badge={nuclei.findings.length}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <NucleiStateBadge state={nuclei.state} />
          {nuclei.run && (
            <div className="text-sm text-[var(--muted-foreground)]">
              Target: <span className="font-mono">{nuclei.run.targetUrl || nuclei.run.targetHost}</span>
            </div>
          )}
        </div>

        {nuclei.run?.originalDomainTarget && nuclei.run?.finalDomainTarget && (
          <div className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Domain Targets</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <TargetContextBadge provenance="original" />
                <span className="font-mono">{nuclei.run.originalDomainTarget}</span>
              </div>
              <div className="flex items-center gap-2">
                <TargetContextBadge provenance="final" />
                <span className="font-mono">{nuclei.run.finalDomainTarget}</span>
              </div>
            </div>
          </div>
        )}

        {findingsByKind.size > 0 ? (
          <Accordion type="multiple" className="space-y-2">
            {Array.from(findingsByKind.entries()).map(([kind, findings]) => (
              <AccordionItem key={kind} value={kind} className="border border-[var(--gray-border)]/20 rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--surface-mid)]/20">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[var(--accent)]" />
                    <span>{kindLabels[kind] || kind}</span>
                    <Badge variant="outline" className="text-xs">
                      {findings.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    {findings.map((finding) => (
                      <div key={finding.matchId} className="p-3 bg-[var(--surface-mid)]/20 rounded-lg">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{finding.templateId}</p>
                            {finding.matchedAt && (
                              <p className="text-xs text-[var(--muted-foreground)] font-mono">{finding.matchedAt}</p>
                            )}
                          </div>
                          {finding.severity && (
                            <Badge
                              variant="outline"
                              className={
                                finding.severity === "critical" || finding.severity === "high"
                                  ? "border-red-400/30 text-red-400"
                                  : finding.severity === "medium"
                                    ? "border-amber-400/30 text-amber-400"
                                    : "border-[var(--gray-border)] text-[var(--muted-foreground)]"
                              }
                            >
                              {finding.severity}
                            </Badge>
                          )}
                        </div>
                        {finding.extractedResults.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {finding.extractedResults.map((result) => (
                              <Badge key={result.slice(0, 50)} variant="outline" className="text-xs font-mono">
                                {result}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {finding.subject && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-[var(--muted-foreground)]">Subject:</span>
                            <span className="text-xs font-mono">{finding.subject}</span>
                            {finding.subjectType && (
                              <Badge variant="outline" className="text-xs">
                                {finding.subjectType}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : nuclei.state === "completed" ? (
          <div className="p-4 bg-[var(--surface-mid)]/20 rounded-lg text-center">
            <CheckCircle2 className="w-5 h-5 text-[var(--muted-foreground)] mx-auto mb-2" />
            <p className="text-[var(--muted-foreground)]">No security findings detected</p>
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  )
}
