"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle, Network, Globe, Server } from "lucide-react"

interface InfrastructureModuleProps {
  dns: {
    hostIp: string
    a: string[]
    aaaa: string[]
    cname: string[]
  }
  asn: {
    asNumber: string
    org: string
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

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[var(--accent)]/10">
            <Network className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[var(--foreground)]">
              Infrastructure
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">
              DNS, ASN and protocol capabilities
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                  DNS Mapping
                </h3>
              </div>
              <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none overflow-hidden">
                <div className="grid grid-cols-[80px_1fr] border-b border-[var(--gray-border)]/10">
                  <div className="px-4 py-3 bg-[var(--surface-mid)]/50 text-xs font-semibold text-[var(--accent)] uppercase">
                    A
                  </div>
                  <div className="px-4 py-3 text-sm font-mono text-[var(--foreground)]">
                    {dns.a[0] || dns.hostIp}
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr] border-b border-[var(--gray-border)]/10">
                  <div className="px-4 py-3 bg-[var(--surface-mid)]/50 text-xs font-semibold text-[var(--accent)] uppercase">
                    AAAA
                  </div>
                  <div className="px-4 py-3 text-sm font-mono text-[var(--foreground)] truncate">
                    {dns.aaaa[0] || "N/A"}
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr] border-b border-[var(--gray-border)]/10">
                  <div className="px-4 py-3 bg-[var(--surface-mid)]/50 text-xs font-semibold text-[var(--accent)] uppercase">
                    ASN
                  </div>
                  <div className="px-4 py-3 text-sm font-mono text-[var(--foreground)]">
                    {asn.asNumber}
                  </div>
                </div>
                <div className="grid grid-cols-[80px_1fr]">
                  <div className="px-4 py-3 bg-[var(--surface-mid)]/50 text-xs font-semibold text-[var(--accent)] uppercase">
                    Org
                  </div>
                  <div className="px-4 py-3 text-sm font-medium text-[var(--foreground)] truncate" title={asn.org}>
                    {asn.org}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                Protocol Capabilities
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {capabilityItems.map((cap) => (
                <Card
                  key={cap.key}
                  className={`bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none ${
                    !cap.enabled ? "opacity-50" : ""
                  }`}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--foreground)]">{cap.label}</span>
                    {cap.enabled ? (
                      <CheckCircle2 className="w-5 h-5 text-[var(--accent)]" />
                    ) : (
                      <XCircle className="w-5 h-5 text-[var(--text-dim)]" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
