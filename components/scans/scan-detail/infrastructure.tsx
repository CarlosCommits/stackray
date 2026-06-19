"use client"

import Link from "next/link"
import { useState } from "react"
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Network,
  Server,
  Wifi,
  XCircle,
} from "lucide-react"

import { LocalTime } from "@/components/ui/local-time"
import type {
  DnsInfrastructureSection,
  DomainProvenance,
  NetworkIntelligenceSection,
} from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import {
  DetailRow,
  SectionPanel,
  SubSectionLabel,
  SummaryStrip,
  TargetContextBadge,
  insetPanelClass,
  insetRowDividerClass,
} from "./shared"

export function DnsInfrastructureCard({ dns }: { dns: DnsInfrastructureSection }) {
  const hasCname = dns.cname.length > 0
  const hasAsnRange = dns.asn.range && dns.asn.range.length > 0
  const totalTxtRecords = dns.txtRecords.reduce((acc, t) => acc + t.records.length, 0)

  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: dns.capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: dns.capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: dns.capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: dns.capabilities.vhost },
  ]
  const hasAnyCapability = capabilityItems.some((cap) => cap.enabled)
  const hasNetworkBlock = Boolean(dns.asn.asNumber || dns.asn.org || hasAsnRange)

  return (
    <SectionPanel
      title="DNS & Network"
      icon={Network}
      description="Authoritative DNS resolution, network routing, and any DNS service fingerprints surfaced by the scan."
    >
      <div className="space-y-5">
        {/* Capabilities */}
        {hasAnyCapability && (
          <div className="space-y-3">
            <SubSectionLabel label="Protocol Capabilities" />
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {capabilityItems.map((cap) => (
                  <div
                    key={cap.key}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md border px-3 py-2 transition-colors",
                      cap.enabled
                        ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                        : "border-[var(--gray-border)]/20 bg-[var(--background)]/40",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[11px] font-medium uppercase tracking-[0.12em]",
                        cap.enabled ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]/70",
                      )}
                    >
                      {cap.label}
                    </span>
                    {cap.enabled ? (
                      <CheckCircle2 className="size-3.5 text-[var(--accent)]" />
                    ) : (
                      <XCircle className="size-3.5 text-[var(--muted-foreground)]/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DNS Records + Network + Nameservers: stacked on mobile, 3-col on lg */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* DNS Records */}
          <div className="space-y-3">
            <SubSectionLabel label="DNS Records" />
            <div className={insetPanelClass}>
              <div className="flex flex-col">
                <DnsRecordRow label="A" value={dns.a.join(", ") || dns.hostIp || null} />
                <DnsRecordRow label="AAAA" value={dns.aaaa.join(", ") || null} />
                <DnsRecordRow label="Resolvers" value={dns.resolvers.join(", ") || null} />
                {hasCname && <DnsRecordRow label="CNAME" value={dns.cname.join(", ")} />}
              </div>
            </div>
          </div>

          {/* ASN */}
          {hasNetworkBlock ? (
            <div className="space-y-3">
              <SubSectionLabel label="Network (ASN)" />
              <div className={cn(insetPanelClass, "p-3")}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-base font-semibold tracking-tight text-[var(--accent)]">
                    {dns.asn.asNumber || "—"}
                  </span>
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {dns.asn.org || "Unknown organization"}
                  </span>
                  {dns.asn.country ? (
                    <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                      {dns.asn.country}
                    </span>
                  ) : null}
                </div>
                {hasAsnRange ? (
                  <div className="relative mt-3 flex flex-wrap gap-1.5 pt-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28">
                    {dns.asn.range!.map((r) => (
                      <span
                        key={r}
                        className="rounded border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Nameservers */}
          {dns.nameservers.length > 0 ? (
            <div className="space-y-3">
              <SubSectionLabel label="Nameservers" count={dns.nameservers.length} />
              <div className={cn(insetPanelClass, "p-3")}>
                <div className="flex flex-wrap gap-1.5">
                  {dns.nameservers.map((ns) => (
                    <span
                      key={ns}
                      className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                    >
                      {ns}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* DNS Services from Nuclei */}
        {dns.dnsServices.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel label="Detected DNS Services" count={dns.dnsServices.length} />
            <div className="grid gap-2 sm:grid-cols-2">
              {groupDnsServicesBySubject(dns.dnsServices).map(({ subject, provenance, services }) => (
                <div
                  key={`${subject}-${provenance}-${services[0]?.serviceName ?? ""}`}
                  className={insetPanelClass}
                >
                  <div className={cn("flex items-center justify-between gap-2 px-3 py-2", insetRowDividerClass)}>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {subject || "Unknown subject"}
                    </span>
                    <TargetContextBadge provenance={provenance} />
                  </div>
                  <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2">
                    {services.map((service) => (
                      <div
                        key={`${service.serviceName}-${service.subject}`}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-[var(--background)]/35"
                      >
                        <Wifi className="size-3.5 shrink-0 text-[var(--accent)]" />
                        <span className="truncate text-sm font-medium text-[var(--foreground)]">
                          {service.serviceName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* TXT Records - full width so long records don't wrap unnecessarily on desktop */}
        {totalTxtRecords > 0 && (
          <div className="space-y-3">
            <SubSectionLabel label="TXT Records" count={totalTxtRecords} />
            <div className="space-y-2">
              {dns.txtRecords.map((txt) => (
                <div
                  key={`${txt.subject}-${txt.records[0]?.slice(0, 20)}`}
                  className={insetPanelClass}
                >
                  <div className={cn("flex items-center justify-between gap-2 px-3 py-2", insetRowDividerClass)}>
                    <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                      {txt.subject || "TXT"}
                    </span>
                    <TargetContextBadge provenance={txt.provenance} />
                  </div>
                  <div className="space-y-0.5 p-3 font-mono text-xs leading-relaxed text-[var(--foreground)]">
                    {txt.records.map((record) => (
                      <p key={record.slice(0, 50)} className="rounded-md px-1 py-0.5 break-all">
                        {record}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

function DnsRecordRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="relative flex flex-col gap-1 px-3 py-2.5 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28 last:after:hidden sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-20 shrink-0 font-heading text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)] sm:text-[11px]">
        {label}
      </span>
      <p className="min-w-0 break-all font-mono text-[13px] leading-snug text-[var(--foreground)]">
        {value || <span className="text-[var(--muted-foreground)]/50">N/A</span>}
      </p>
    </div>
  )
}

// InfoPopover: a tappable info icon that opens a Popover with explanatory
// text. Works on both touch (mobile) and click (desktop) unlike Tooltip,
// which is hover/focus only.

function groupDnsServicesBySubject(
  services: DnsInfrastructureSection["dnsServices"],
): Array<{
  subject: string
  provenance: DomainProvenance
  services: DnsInfrastructureSection["dnsServices"]
}> {
  const groups = new Map<string, { subject: string; provenance: DomainProvenance; services: DnsInfrastructureSection["dnsServices"] }>()

  for (const service of services) {
    const subject = service.subject ?? ""
    const key = `${subject}::${service.provenance}`
    const existing = groups.get(key)
    if (existing) {
      existing.services.push(service)
      continue
    }
    groups.set(key, {
      subject,
      provenance: service.provenance,
      services: [service],
    })
  }

  return [...groups.values()]
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

  const summaryTiles = [
    { icon: MapPin, label: "IP", value: network.ip },
    { icon: Server, label: "Provider", value: network.providerName ?? "Unknown" },
    { icon: Globe, label: "Source", value: network.providerSource?.toUpperCase() ?? "BGP" },
    { icon: Network, label: "CIDR", value: cidr ?? "N/A" },
  ]

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
    <SectionPanel
      title="IP Intelligence"
      icon={Network}
      badge={network.providerName ?? externalDomains.length}
      description="RDAP registration, BGP routing, and reverse-IP observations stitched together for the scanned host."
    >
      <div className="space-y-5">
        {/* Summary strip */}
        <SummaryStrip tiles={summaryTiles} />

        {/* RDAP + BGP Origin - side by side on desktop */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <SubSectionLabel
              label="RDAP"
              description="Registration Data Access Protocol data from the regional internet registry. Contact addresses here belong to the person or entity registered to the IP assignment and do not necessarily show the physical server location."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <DetailRow
                label="RDAP Registry"
                value={network.rdap.registry?.toUpperCase() ?? null}
                description="The registry inferred from the returned RDAP object itself, such as its port43 server or RDAP links. This is the best registry label for the specific assignment."
              />
              <DetailRow
                label="IANA Bootstrap"
                value={network.rdap.bootstrapRegistry?.toUpperCase() ?? null}
                description="The registry IANA's RDAP bootstrap selected as the starting lookup endpoint for the broader address block. More-specific assignments can point to a different RDAP registry."
              />
              <DetailRow label="Network" value={network.rdap.name} mono={false} />
              <DetailRow label="Handle" value={network.rdap.handle} />
              <DetailRow label="Parent Handle" value={network.rdap.parentHandle} />
              <DetailRow label="Type" value={network.rdap.type} mono={false} />
              <DetailRow label="Status" value={network.rdap.status.join(", ") || null} mono={false} />
              <DetailRow label="Country" value={network.rdap.country} mono={false} />
              <DetailRow
                label="Range"
                value={network.rdap.startAddress && network.rdap.endAddress ? `${network.rdap.startAddress} — ${network.rdap.endAddress}` : null}
              />
              <DetailRow label="Lookup URL" value={network.rdap.queryUrl} />
              {network.rdap.fallbackFrom ? <DetailRow label="Fallback From" value={network.rdap.fallbackFrom} /> : null}
            </div>
          </div>

          <div className="space-y-3">
            <SubSectionLabel
              label="BGP Origin"
              description="Border Gateway Protocol origin data for the routed prefix currently announcing this IP. This is usually the strongest signal for the network operator or hosting provider."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <DetailRow label="ASN" value={network.bgp.asNumber} />
              <DetailRow label="Name" value={network.bgp.description} mono={false} />
              <DetailRow label="Prefix" value={network.bgp.prefix} />
              <DetailRow label="Country" value={network.bgp.country} mono={false} />
              <DetailRow label="Registry" value={network.bgp.registry?.toUpperCase() ?? null} />
              <DetailRow label="Allocated" value={network.bgp.allocatedAt} />
              <DetailRow label="Source" value={network.bgp.source} mono={false} />
            </div>
          </div>
        </div>

        {/* RDAP Contacts */}
        {network.rdap.entities.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="RDAP Contacts"
              count={network.rdap.entities.length}
              description="Registration contacts and entities attached to the RDAP assignment. Addresses identify registered contacts or organizations, not necessarily where the server hardware is located."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {network.rdap.entities.map((entity, index) => (
                <div
                  key={`${entity.handle ?? entity.name ?? entity.organization ?? "entity"}-${index}`}
                  className={cn(insetPanelClass, "p-3")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {entity.name ?? entity.organization ?? entity.handle ?? "Unknown entity"}
                    </span>
                    {entity.roles.map((role) => (
                      <span
                        key={role}
                        className="border border-[var(--gray-border)]/35 bg-[var(--surface-mid)]/25 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)]"
                      >
                        {entity.relationship === "contact" ? role : `${role} ${entity.relationship}`}
                      </span>
                    ))}
                  </div>
                  {entity.organization && entity.organization !== entity.name ? (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">{entity.organization}</p>
                  ) : null}
                  {entity.handle ? (
                    <p className="mt-1 font-mono text-xs text-[var(--muted-foreground)]">{entity.handle}</p>
                  ) : null}
                  {entity.address ? (
                    <p className="relative mt-2 whitespace-pre-line pt-2 font-mono text-xs leading-relaxed text-[var(--muted-foreground)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/28">
                      {entity.address}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* PTR */}
        {network.ptr.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="PTR"
              count={network.ptr.length}
              description="Reverse DNS pointer records returned by DNS for the IP address. PTR names are useful context, but they are operator-controlled and can be stale or misleading."
            />
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="flex flex-wrap gap-1.5">
                {network.ptr.map((ptr) => (
                  <span
                    key={ptr}
                    className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                  >
                    {ptr}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Co-hosts */}
        {coHostGroups.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label="Stackray Co-hosts"
              count={coHostGroups.length}
              description="Other scans in this Stackray database that resolved to the same host IP. This is local intelligence from your own scan history, not a third-party dataset."
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {coHostGroups.map((group) => (
                <div key={group.key} className={insetPanelClass}>
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link
                        href={`/scans/${group.matches[0]?.scanId ?? ""}`}
                        className="break-all font-medium text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
                      >
                        {group.target}
                      </Link>
                      {group.title ? (
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">{group.title}</span>
                      ) : null}
                    </div>
                    {group.matches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => toggleCoHostGroup(group.key)}
                        className="inline-flex shrink-0 items-center gap-1 border border-[var(--gray-border)]/40 bg-[var(--surface-mid)]/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
                        aria-expanded={expandedCoHostKeys.has(group.key)}
                      >
                        {group.matches.length}
                        {expandedCoHostKeys.has(group.key) ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      </button>
                    ) : null}
                  </div>
                  {group.matches.length > 1 && expandedCoHostKeys.has(group.key) ? (
                    <div className="relative px-3 py-2 before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-[var(--gray-border)]/18">
                      <div className="flex flex-col">
                        {group.matches.map((match) => (
                          <Link
                            key={`${match.scanId}-${match.resultId}`}
                            href={`/scans/${match.scanId}`}
                            className={cn(
                              "flex flex-col gap-1 px-2 py-2 text-xs transition-colors hover:bg-[var(--surface-mid)]/42 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                              insetRowDividerClass,
                            )}
                          >
                            <span className="min-w-0 break-words text-[var(--muted-foreground)] sm:truncate">
                              {match.title || match.finalUrl || match.target}
                            </span>
                            <LocalTime
                              value={match.observedAt}
                              preset="shortDateTimeWithZone"
                              className="shrink-0 font-mono text-[var(--foreground)]"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* External Reverse IP - cards on mobile, table on lg+ */}
        {externalDomains.length > 0 ? (
          <div className="space-y-3">
            <SubSectionLabel
              label={`External Reverse IP${network.reverseIp.provider ? ` · ${network.reverseIp.provider}` : ""}`}
              count={externalDomains.length}
              description="Hostnames from a public reverse-IP dataset that have been observed on this IP. This is passive OSINT and can be incomplete, rate-limited, or stale."
            />
            {/* Mobile: card grid */}
            <div className="grid gap-2 lg:hidden">
              {reverseDomainRows.map((row, index) => (
                <div
                  key={row.id}
                  className={cn(insetPanelClass, "p-3 transition-colors hover:border-[var(--gray-border)]/55 hover:bg-[var(--surface-mid)]/28")}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--muted-foreground)]/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="min-w-0 break-all font-mono text-sm font-medium text-[var(--foreground)]">
                      {row.domain}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 pl-7 font-mono text-xs text-[var(--muted-foreground)]">
                    <span className="min-w-0 truncate">
                      <span className="text-[var(--muted-foreground)]/60">base:</span>{" "}
                      <span className="text-[var(--foreground)]/85">{row.baseDomain}</span>
                    </span>
                    {row.prefix !== "@" && (
                      <span className="min-w-0 truncate">
                        <span className="text-[var(--muted-foreground)]/60">prefix:</span>{" "}
                        <span className="text-[var(--foreground)]/85">{row.prefix}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className={cn(insetPanelClass, "hidden lg:block")}>
              <table className="w-full text-left text-sm">
                <thead className="relative bg-[var(--surface-mid)]/28 text-[10px] uppercase tracking-[0.12em] text-[var(--muted-foreground)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--gray-border)]/28">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2 font-semibold">#</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Hostname</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Base Domain</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Prefix</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {reverseDomainRows.map((row, index) => (
                    <tr key={row.id} className={cn("bg-[var(--surface-mid)]/18 transition-colors hover:bg-[var(--surface-mid)]/30", insetRowDividerClass)}>
                      <td className="px-3 py-1.5 text-[var(--muted-foreground)] tabular-nums">{index + 1}</td>
                      <td className="break-all px-3 py-1.5 text-[var(--foreground)]">{row.domain}</td>
                      <td className="px-3 py-1.5 text-[var(--foreground)]">{row.baseDomain}</td>
                      <td className="break-all px-3 py-1.5 text-[var(--muted-foreground)]">{row.prefix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(network.reverseIp.sourceUrl || network.reverseIp.fallbackFrom) ? (
              <div className={cn(insetPanelClass, "p-3")}>
                <DetailRow label="Source URL" value={network.reverseIp.sourceUrl} align="left" />
                {network.reverseIp.fallbackFrom ? <DetailRow label="Fallback From" value={network.reverseIp.fallbackFrom} align="left" /> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasErrors ? (
          <p className="border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-300">
            Some IP intelligence sources returned partial data. Raw errors are retained in the enrichment record.
          </p>
        ) : null}

        {network.refreshedAt ? (
          <p className="relative pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]/80 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[var(--gray-border)]/24">
            Updated <LocalTime value={network.refreshedAt} preset="shortDateTimeWithZone" />
          </p>
        ) : null}
      </div>
    </SectionPanel>
  )
}
