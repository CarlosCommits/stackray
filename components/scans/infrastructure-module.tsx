"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, XCircle, Network, Globe, Database, MapPin } from "lucide-react"

interface InfrastructureModuleProps {
  dns: {
    hostIp: string | null
    a: string[]
    aaaa: string[]
    cname: string[]
    resolvers: string[]
  }
  asn: {
    asNumber: string | null
    org: string | null
    country?: string | null
    range?: string[]
  }
  capabilities: {
    http2: boolean
    pipeline: boolean
    websocket: boolean
    vhost: boolean
  }
}

export function InfrastructureModule({ dns, asn, capabilities }: InfrastructureModuleProps) {
  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: capabilities.vhost },
  ]

  const hasCname = dns.cname.length > 0
  const hasResolvers = dns.resolvers.length > 0
  const hasAsnRange = asn.range && asn.range.length > 0

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30 py-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
            <Network className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-[var(--foreground)]">
              Infrastructure
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">
              DNS, ASN and protocol capabilities
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {capabilityItems.map((cap) => (
            <div
              key={cap.key}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                cap.enabled
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : "border-[var(--gray-border)]/20 bg-[var(--gray-charcoal)]/50 opacity-60"
              }`}
            >
              <span className="text-xs font-medium text-[var(--foreground)]">{cap.label}</span>
              {cap.enabled ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              )}
            </div>
          ))}
        </div>

        <Separator className="bg-[var(--gray-border)]/10" />

        <div className="space-y-2">
          <Card size="sm" className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardHeader className="p-2 pb-0">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                <CardTitle className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">
                  DNS
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-1.5">
              <div className="flex gap-2 items-start">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0 h-5 mt-0.5">
                  A
                </Badge>
                <div className="flex-1 min-w-0">
                  {dns.a.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {dns.a.map((record) => (
                        <code key={record} className="text-xs text-[var(--foreground)] break-all">
                          {record}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <code className="text-xs text-[var(--text-dim)]">{dns.hostIp || "N/A"}</code>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-start">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0 h-5 mt-0.5">
                  AAAA
                </Badge>
                <div className="flex-1 min-w-0">
                  {dns.aaaa.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {dns.aaaa.map((record) => (
                        <code key={record} className="text-xs text-[var(--foreground)] break-all">
                          {record}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <code className="text-xs text-[var(--text-dim)]">N/A</code>
                  )}
                </div>
              </div>

              {hasCname && (
                <div className="flex gap-2 items-start">
                  <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0 h-5 mt-0.5">
                    CNAME
                  </Badge>
                  <div className="flex-1 min-w-0 flex flex-wrap gap-x-2 gap-y-0.5">
                    {dns.cname.map((record) => (
                      <code key={record} className="text-xs text-[var(--foreground)] break-all">
                        {record}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {hasResolvers && (
                <div className="flex gap-2 items-start">
                  <Badge variant="outline" className="border-[var(--text-dim)]/40 text-[var(--text-dim)] text-xs shrink-0 h-5 mt-0.5">
                    Resolver
                  </Badge>
                  <div className="flex-1 min-w-0 flex flex-wrap gap-x-2 gap-y-0.5">
                    {dns.resolvers.map((resolver) => (
                      <code key={resolver} className="text-xs text-[var(--text-dim)] break-all">
                        {resolver}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card size="sm" className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardHeader className="p-2 pb-0">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[var(--accent)]" />
                <CardTitle className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wide">
                  ASN
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0">
                  {asn.asNumber || "N/A"}
                </Badge>
                <span className="text-xs text-[var(--foreground)] break-all">
                  {asn.org || "Unknown organization"}
                </span>
              </div>

              {asn.country && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)]">
                  <MapPin className="w-3 h-3" />
                  <span>{asn.country}</span>
                </div>
              )}

              {hasAsnRange && (
                <div className="pt-0.5">
                  <span className="text-xs text-[var(--text-dim)] block mb-1">Ranges</span>
                  <div className="flex flex-wrap gap-1">
                    {asn.range!.map((r) => (
                      <Badge
                        key={r}
                        variant="outline"
                        className="border-[var(--gray-border)] text-[var(--text-dim)] text-xs font-mono"
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
