"use client"

import { useState } from "react"
import { CheckCircle2, FileText, Globe, MinusCircle } from "lucide-react"

import type {
  ContentSignalsSection,
  DomainIntelligenceSection,
  DomainMetadata,
} from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import {
  CompactCard,
  SectionPanel,
  TargetContextBadge,
  insetHeaderDividerClass,
  insetPanelClass,
} from "./shared"

export function DomainInfoSection({ domain }: { domain: DomainIntelligenceSection }) {
  if (domain.metadata.length === 0) {
    return (
      <SectionPanel
        title="Domain Info"
        icon={FileText}
        description="Registrar and registry metadata for the domain."
      >
        <p className="text-sm text-[var(--muted-foreground)]">No domain metadata available</p>
      </SectionPanel>
    )
  }

  return (
    <SectionPanel
      title="Domain Info"
      icon={FileText}
      description="Registrar, registry, and lifecycle dates pulled from WHOIS for each domain in scope."
    >
      <div className="space-y-3">
        {domain.metadata.map((metadata) => (
          <DomainMetadataCard key={metadata.subject} metadata={metadata} />
        ))}
      </div>
    </SectionPanel>
  )
}

function DomainMetadataCard({ metadata }: { metadata: DomainMetadata }) {
  const registrationDate = metadata.registrationDate
    ? new Date(metadata.registrationDate)
    : null
  const expirationDate = metadata.expirationDate
    ? new Date(metadata.expirationDate)
    : null
  const lastChangedDate = metadata.lastChangedDate
    ? new Date(metadata.lastChangedDate)
    : null
  const [daysToExpiry] = useState<number | null>(() => {
    if (!expirationDate) {
      return null
    }
    return Math.round((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  })
  const isExpiringSoon = daysToExpiry !== null && daysToExpiry < 60 && daysToExpiry >= 0
  const isExpired = daysToExpiry !== null && daysToExpiry < 0

  const formatDate = (date: Date | null) =>
    date
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null

  return (
    <div className={cn(insetPanelClass, "p-3 sm:p-4")}>
      {/* Header: subject + provenance */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Globe className="size-4 shrink-0 text-[var(--accent)]" />
          <span className="truncate font-mono text-sm font-medium text-[var(--foreground)]">
            {metadata.subject}
          </span>
        </div>
        <TargetContextBadge provenance={metadata.provenance} />
      </div>

      {/* Registrar + lifecycle in a 2-col grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metadata.registrarName ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar</p>
            <p className="font-medium text-[var(--foreground)]">{metadata.registrarName}</p>
            {metadata.registrarIanaId ? (
              <p className="font-mono text-xs text-[var(--muted-foreground)]">IANA ID: {metadata.registrarIanaId}</p>
            ) : null}
          </div>
        ) : null}
        {metadata.registrarUrl ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar URL</p>
            <a
              href={metadata.registrarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-[var(--accent)] hover:underline"
            >
              {metadata.registrarUrl}
            </a>
          </div>
        ) : null}
        {metadata.registrarEmail ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar Email</p>
            <p className="break-all font-mono text-sm text-[var(--foreground)]">{metadata.registrarEmail}</p>
          </div>
        ) : null}
        {metadata.registrarPhone ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registrar Phone</p>
            <p className="break-all font-mono text-sm text-[var(--foreground)]">{metadata.registrarPhone}</p>
          </div>
        ) : null}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Registered</p>
          <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(registrationDate) ?? "—"}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Expires</p>
          <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(expirationDate) ?? "—"}</p>
        </div>
        {lastChangedDate ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Last Changed</p>
            <p className="font-mono text-sm text-[var(--foreground)]">{formatDate(lastChangedDate)}</p>
          </div>
        ) : null}
        {metadata.dnssec ? (
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">DNSSEC</p>
            <p className={metadata.dnssec === "true" ? "text-sm text-emerald-400" : "text-sm text-orange-400"}>
              {metadata.dnssec === "true" ? "Enabled" : "Disabled"}
            </p>
          </div>
        ) : null}
      </div>

      {/* Nameservers + status in a shared footer */}
      {(metadata.nameservers.length > 0 || metadata.status.length > 0) && (
        <div className="relative mt-4 grid grid-cols-1 gap-4 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28 sm:grid-cols-2">
          {metadata.nameservers.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Nameservers <span className="text-[var(--muted-foreground)]/60">· {metadata.nameservers.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.nameservers.map((ns) => (
                  <span
                    key={ns}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                  >
                    {ns}
                  </span>
                ))}
              </div>
            </div>
          )}
          {metadata.status.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Status <span className="text-[var(--muted-foreground)]/60">· {metadata.status.length}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {metadata.status.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isExpired && daysToExpiry !== null ? (
        <div className="mt-3 rounded-md border border-red-400/35 bg-red-400/5 px-3 py-2 text-xs text-red-300">
          Domain expired {Math.abs(daysToExpiry)} days ago.
        </div>
      ) : isExpiringSoon && daysToExpiry !== null ? (
        <div className="mt-3 rounded-md border border-amber-400/35 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          Domain expires in {daysToExpiry} days.
        </div>
      ) : null}
    </div>
  )
}

// Robots.txt Section
export function RobotsTxtSection({ content }: { content: ContentSignalsSection }) {
  const { robotsTxt } = content

  return (
    <CompactCard title="Robots.txt" icon={FileText}>
      {robotsTxt ? (
        <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/35 ring-1 ring-white/5">
          <div className={cn("flex flex-wrap items-center gap-2 bg-[var(--surface-mid)]/30 px-3 py-2", insetHeaderDividerClass)}>
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400">
              Found
            </span>
            {robotsTxt.matchedAt ? (
              <span
                className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                title={robotsTxt.matchedAt}
              >
                {robotsTxt.matchedAt.replace(/^https?:\/\//, "")}
              </span>
            ) : null}
          </div>
          {robotsTxt.extractedResults.length > 0 ? (
            <div className="max-h-72 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              {robotsTxt.extractedResults.map((result) => (
                <p key={result.slice(0, 50)} className="break-words">
                  {result}
                </p>
              ))}
            </div>
          ) : (
            <p className="p-3 text-xs text-[var(--muted-foreground)]">No directives parsed.</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-border)]/45 bg-[var(--background)]/35 px-3 py-3 ring-1 ring-white/5">
          <MinusCircle className="size-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-sm text-[var(--muted-foreground)]">No robots.txt detected</span>
        </div>
      )}
    </CompactCard>
  )
}

// CompactCard: a small bordered card with an icon + title header, used in
// the Scan Info grid and other multi-card layouts.
