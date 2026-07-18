"use client"

import Link from "next/link"
import { useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink as LinkIcon,
  Globe2,
  History,
  Info,
} from "lucide-react"

import { LocalTime } from "@/components/ui/local-time"
import { RawEvidenceSummaryCards, RawEvidenceTabs } from "@/components/scans/raw-evidence-tabs"
import type {
  ContentSignalsSection,
  DeliveryRedirectsSection,
  HistorySection,
  RawEvidenceSection,
} from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import { CompactCard, DetailRow, insetRowDividerClass } from "./shared"

// Redirect Chain Card
export function RedirectChainCard({ delivery }: { delivery: DeliveryRedirectsSection }) {
  const hasRedirects = delivery.redirectChain.items.length > 1
  const hopCount = Math.max(delivery.redirectChain.items.length - 1, 0)

  return (
    <CompactCard
      title="Redirect Chain"
      icon={LinkIcon}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {hopCount} hop{hopCount === 1 ? "" : "s"}
        </span>
      }
    >
      {hasRedirects ? (
        <div className="flex flex-col items-stretch">
          {delivery.redirectChain.items.map((hop, hopIdx) => {
            const statusCode = hop.statusCode ?? delivery.redirectChain.statusCodes[hopIdx]
            const statusColor =
              statusCode === undefined
                ? "text-[var(--muted-foreground)]"
                : statusCode >= 200 && statusCode < 300
                  ? "text-emerald-400"
                  : statusCode >= 300 && statusCode < 400
                    ? "text-amber-400"
                    : "text-red-400"
            return (
              <div key={`${hop.url}-${statusCode}`} className="flex flex-col">
                <div className="flex items-start gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/40 px-2.5 py-2 ring-1 ring-white/5 transition-colors hover:border-[var(--accent)]/45">
                  <span className={cn("mt-0.5 shrink-0 font-mono text-xs font-semibold tabular-nums", statusColor)}>
                    {statusCode ?? "—"}
                  </span>
                  <span className="min-w-0 break-all font-mono text-[12px] text-[var(--foreground)]">{hop.url}</span>
                </div>
                {hopIdx < delivery.redirectChain.items.length - 1 ? (
                  <div className="ml-[1.05rem] flex h-3 w-px items-center justify-center bg-[var(--accent)]/45">
                    <ChevronDown className="size-2.5 -translate-y-[3px] bg-[var(--surface-dark)] text-[var(--accent)]/70" />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/40 px-3 py-2.5 text-sm text-[var(--muted-foreground)] ring-1 ring-white/5">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
          <span>No redirects, direct response</span>
        </div>
      )}
    </CompactCard>
  )
}

// Body Domains Card
export function BodyDomainsCard({ content }: { content: ContentSignalsSection }) {
  const [viewAll, setViewAll] = useState(false)
  const totalDomains = content.bodyDomains.length + content.bodyFqdns.length
  const hasHiddenDomains = content.bodyDomains.length > 18 || content.bodyFqdns.length > 12
  const visibleBodyDomains = viewAll ? content.bodyDomains : content.bodyDomains.slice(0, 18)
  const visibleBodyFqdns = viewAll ? content.bodyFqdns : content.bodyFqdns.slice(0, 12)

  return (
    <CompactCard
      title="Body Domains"
      icon={Globe2}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {totalDomains}
        </span>
      }
    >
      <div className="space-y-3">
        {content.bodyDomains.length > 0 ? (
          <div>
            <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              Apex domains <span className="text-[var(--muted-foreground)]/60">· {content.bodyDomains.length}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleBodyDomains.map((domain) => (
                <span
                  key={domain}
                  className="rounded border border-[var(--gray-border)]/30 bg-[var(--background)]/40 px-2 py-1 text-xs text-[var(--foreground)]"
                >
                  {domain}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {content.bodyFqdns.length > 0 ? (
          <div>
            <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
              FQDNs <span className="text-[var(--muted-foreground)]/60">· {content.bodyFqdns.length}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {visibleBodyFqdns.map((fqdn) => (
                <span
                  key={fqdn}
                  className="rounded border border-[var(--gray-border)]/30 bg-[var(--background)]/40 px-2 py-1 font-mono text-[11px] text-[var(--foreground)]"
                >
                  {fqdn}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {hasHiddenDomains ? (
          <button
            type="button"
            onClick={() => setViewAll(!viewAll)}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--accent)] transition-colors hover:text-[var(--accent)]/80"
          >
            {viewAll ? "← View less" : `View all ${totalDomains} domains →`}
          </button>
        ) : null}
      </div>
    </CompactCard>
  )
}

// History Card
export function HistoryCard({ history }: { history: HistorySection }) {
  const getStatusDot = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-400"
      case "failed":
        return "bg-red-400"
      case "cancelled":
        return "bg-amber-400"
      default:
        return "bg-[var(--muted-foreground)]"
    }
  }

  return (
    <CompactCard
      title="Previous Scans"
      icon={History}
      badge={
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80">
          {history.items.length}
        </span>
      }
      bodyClassName="p-0"
    >
      <div>
        {history.items.map((item) => (
          <Link
            key={item.scanId}
            href={`/scans/${item.scanId}`}
            className={cn("group block px-3 py-2.5 transition-colors hover:bg-[var(--surface-mid)]/25", insetRowDividerClass)}
          >
            <div className="flex items-baseline gap-3">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", getStatusDot(item.status))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]">
                    {item.title || "Untitled"}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
                    {item.status}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--muted-foreground)]/80">
                  <LocalTime value={item.completedAt} preset="shortDateTimeWithZone" />
                  <span>·</span>
                  <span>{item.technologies.length} tech</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </CompactCard>
  )
}

// Scan Info Card
export function ScanInfoCard({
  scanId,
  source,
  submittedAt,
  completedAt,
  asnNumber,
}: {
  scanId: string
  source: string
  submittedAt: string
  completedAt: string | null
  asnNumber: string | null
}) {
  return (
    <CompactCard title="Scan Info" icon={Info} bodyClassName="p-1">
      <DetailRow label="Source" value={source} mono={false} />
      <DetailRow label="Scan ID" value={scanId} />
      <DetailRow
        label="Submitted"
        value={<LocalTime value={submittedAt} preset="shortDateTimeWithZone" />}
      />
      {completedAt ? (
        <DetailRow
          label="Completed"
          value={<LocalTime value={completedAt} preset="shortDateTimeWithZone" />}
        />
      ) : null}
      {asnNumber ? <DetailRow label="ASN" value={asnNumber} /> : null}
    </CompactCard>
  )
}

export { RawEvidenceSummaryCards }

// Raw Evidence Section Component
export function RawEvidenceCard({ rawEvidence }: { rawEvidence: RawEvidenceSection }) {
  return (
    <div id="raw-evidence" className="scroll-mt-24">
      <RawEvidenceTabs
        rawHttpx={rawEvidence.rawHttpx}
        nuclei={rawEvidence.nuclei}
      />
    </div>
  )
}
