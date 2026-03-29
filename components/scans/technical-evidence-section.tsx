"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { Network, Globe, Database, MapPin, CheckCircle2, XCircle, Route, ArrowRight, Clock, Link2, FileType, Hash, Fingerprint, ShieldCheck, Lock, FileKey, Calendar } from "lucide-react"

interface TechnicalEvidenceSectionProps {
  // Delivery
  finalUrl: string
  path: string
  method: string
  location: string | null
  contentType: string | null
  responseTimeMs: number
  redirectChain: {
    statusCodes: number[]
    items: Array<{
      url?: string
      statusCode?: number
      location?: string | null
      contentLength?: number
      responseTimeMs?: number
    }>
  }
  // DNS / Infrastructure
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
  // TLS / Fingerprints
  tls: {
    sni: string
    jarmHash: string
    certificate?: Record<string, unknown>
  }
  favicon: {
    mmh3: string
    md5: string
    url: string
    path: string
  }
}

export function TechnicalEvidenceSection({
  finalUrl,
  path,
  method,
  location,
  contentType,
  responseTimeMs,
  redirectChain,
  dns,
  asn,
  capabilities,
  tls,
  favicon,
}: TechnicalEvidenceSectionProps) {
  const hasRedirects = redirectChain.statusCodes.length > 1
  const hopCount = redirectChain.items.length

  const capabilityItems = [
    { key: "http2", label: "HTTP/2", enabled: capabilities.http2 },
    { key: "websocket", label: "WebSocket", enabled: capabilities.websocket },
    { key: "pipeline", label: "Pipeline", enabled: capabilities.pipeline },
    { key: "vhost", label: "VHost", enabled: capabilities.vhost },
  ]

  const hasCname = dns.cname.length > 0
  const hasResolvers = dns.resolvers.length > 0
  const hasAsnRange = asn.range && asn.range.length > 0

  const formatUrl = (url: string | undefined): string => {
    if (!url) return "N/A"
    try {
      const parsed = new URL(url)
      return `${parsed.hostname}${parsed.pathname}`
    } catch {
      return url.length > 50 ? `${url.slice(0, 50)}...` : url
    }
  }

  const getStatusColor = (code: number | undefined): string => {
    if (!code) return "text-[var(--muted-foreground)]"
    if (code >= 200 && code < 300) return "text-emerald-400"
    if (code >= 300 && code < 400) return "text-amber-400"
    if (code >= 400) return "text-red-400"
    return "text-[var(--foreground)]"
  }

  // Certificate helpers
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
    <section className="scan-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Network className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <h2 className="scan-section-title">Technical Evidence</h2>
      </div>

      <Accordion type="multiple" defaultValue={["delivery", "dns"]} className="space-y-3">
        {/* Delivery & Redirects */}
        <AccordionItem value="delivery" className="scan-panel border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--surface-mid)]/50">
            <div className="flex items-center gap-3">
              <Route className="w-4 h-4 text-[var(--accent)]" />
              <span className="scan-panel-title">Delivery & Redirects</span>
              {hasRedirects && (
                <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                  {hopCount - 1} redirect{hopCount - 1 !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Final URL</span>
                </div>
                <p className="text-sm font-mono text-[var(--foreground)] break-all" title={finalUrl}>
                  {formatUrl(finalUrl)}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Path</span>
                </div>
                <p className="text-sm font-mono text-[var(--foreground)] break-all">
                  {path || "/"}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Response Time</span>
                </div>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {responseTimeMs}<span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">ms</span>
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                  <FileType className="w-3.5 h-3.5" />
                  <span>Content Type</span>
                </div>
                <p className="text-sm text-[var(--foreground)] break-all" title={contentType ?? undefined}>
                  {contentType || "N/A"}
                </p>
              </div>
            </div>

            {location && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-[var(--gray-charcoal)] border border-[var(--gray-border)]/10 mb-4">
                <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-[var(--muted-foreground)]">Location Header</span>
                  <p className="text-sm font-mono text-[var(--foreground)] break-all" title={location}>
                    {location}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-[var(--muted-foreground)]">Method</span>
              <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-sm font-mono">
                {method}
              </Badge>
            </div>

            <Separator className="bg-[var(--gray-border)]/10 my-4" />

            {hasRedirects ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Redirect Chain</h3>
                <div className="space-y-2">
                  {redirectChain.items.map((hop, index) => {
                    const isLast = index === redirectChain.items.length - 1
                    const statusCode = hop.statusCode ?? redirectChain.statusCodes[index]
                    const hopLocation = hop.location ?? null
                    const hopKey = hop.url ? `${hop.url}-${index}` : `hop-${index}`

                    return (
                      <Card key={hopKey} className={`bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none ${isLast ? "border-l-2 border-l-[var(--accent)]" : ""}`}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className={`text-sm font-mono ${getStatusColor(statusCode)} border-current`}>
                                {statusCode || "—"}
                              </Badge>
                              {!isLast && (
                                <ArrowRight className="w-3 h-3 text-[var(--muted-foreground)] rotate-90" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-mono text-[var(--foreground)] break-all" title={hop.url}>
                                {formatUrl(hop.url)}
                              </p>
                              {hopLocation && (
                                <p className="text-xs text-[var(--muted-foreground)] break-all" title={hopLocation}>
                                  → {hopLocation}
                                </p>
                              )}
                              <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
                                {hop.responseTimeMs !== undefined && (
                                  <span>{hop.responseTimeMs}ms</span>
                                )}
                                {hop.contentLength !== undefined && (
                                  <span>{hop.contentLength.toLocaleString()} bytes</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Route className="w-4 h-4" />
                <span>No redirects — direct response</span>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* DNS & Infrastructure */}
        <AccordionItem value="dns" className="scan-panel border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--surface-mid)]/50">
            <div className="flex items-center gap-3">
              <Database className="w-4 h-4 text-[var(--accent)]" />
              <span className="scan-panel-title">DNS & Infrastructure</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {/* Capabilities */}
            <div className="flex flex-wrap gap-2 mb-4">
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

            <Separator className="bg-[var(--gray-border)]/10 my-4" />

            <div className="space-y-4">
              {/* DNS Records */}
              <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <CardTitle className="text-sm font-semibold text-[var(--foreground)]">DNS Records</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-2">
                  <div className="flex gap-2 items-start">
                    <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0 h-5 mt-0.5">
                      A
                    </Badge>
                    <div className="flex-1 min-w-0">
                      {dns.a.length > 0 ? (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {dns.a.map((record) => (
                            <code key={record} className="text-sm text-[var(--foreground)] break-all font-mono">
                              {record}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <code className="text-sm text-[var(--muted-foreground)] font-mono">{dns.hostIp || "N/A"}</code>
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
                            <code key={record} className="text-sm text-[var(--foreground)] break-all font-mono">
                              {record}
                            </code>
                          ))}
                        </div>
                      ) : (
                        <code className="text-sm text-[var(--muted-foreground)] font-mono">N/A</code>
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
                          <code key={record} className="text-sm text-[var(--foreground)] break-all font-mono">
                            {record}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasResolvers && (
                    <div className="flex gap-2 items-start">
                      <Badge variant="outline" className="border-[var(--muted-foreground)]/40 text-[var(--muted-foreground)] text-xs shrink-0 h-5 mt-0.5">
                        Resolver
                      </Badge>
                      <div className="flex-1 min-w-0 flex flex-wrap gap-x-2 gap-y-0.5">
                        {dns.resolvers.map((resolver) => (
                          <code key={resolver} className="text-sm text-[var(--muted-foreground)] break-all font-mono">
                            {resolver}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ASN */}
              <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <CardTitle className="text-sm font-semibold text-[var(--foreground)]">ASN</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs shrink-0">
                      {asn.asNumber || "N/A"}
                    </Badge>
                    <span className="text-sm text-[var(--foreground)] break-all">
                      {asn.org || "Unknown organization"}
                    </span>
                  </div>

                  {asn.country && (
                    <div className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
                      <MapPin className="w-3 h-3" />
                      <span>{asn.country}</span>
                    </div>
                  )}

                  {hasAsnRange && (
                    <div className="pt-1">
                      <span className="text-sm text-[var(--muted-foreground)] block mb-1">Ranges</span>
                      <div className="flex flex-wrap gap-1">
                        {asn.range!.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs font-mono"
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
          </AccordionContent>
        </AccordionItem>

        {/* TLS & Fingerprints */}
        <AccordionItem value="tls" className="scan-panel border-0">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--surface-mid)]/50">
            <div className="flex items-center gap-3">
              <Fingerprint className="w-4 h-4 text-[var(--accent)]" />
              <span className="scan-panel-title">TLS & Fingerprints</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {/* JARM Hash */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">JARM Hash</span>
              </div>
              <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                <CardContent className="p-3">
                  <p className="text-sm font-mono break-all text-[var(--foreground)]">
                    {tls.jarmHash}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Favicon Fingerprints */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">Favicon Fingerprints</span>
              </div>
              <div className="space-y-2">
                <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                        MMH3
                      </Badge>
                      <span className="text-xs text-[var(--muted-foreground)]">{favicon.path || "/favicon.ico"}</span>
                    </div>
                    <p className="text-sm font-mono break-all text-[var(--foreground)]">
                      {favicon.mmh3}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                        MD5
                      </Badge>
                    </div>
                    <p className="text-sm font-mono break-all text-[var(--foreground)]">
                      {favicon.md5}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* TLS Certificate */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">TLS Certificate</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                  {tls.sni ? "Verified" : "No SNI"}
                </Badge>
                <span className="text-sm font-medium text-[var(--foreground)]">{tls.sni || "N/A"}</span>
              </div>

              {cert && Object.keys(cert).length > 0 && (
                <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                  <CardContent className="p-3 space-y-3">
                    {getCertField("subject") && (
                      <div className="flex items-start gap-2">
                        <Lock className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--muted-foreground)] block">Subject</span>
                          <span className="text-sm font-mono text-[var(--foreground)] break-all">{getCertField("subject")}</span>
                        </div>
                      </div>
                    )}
                    {getCertField("issuer") && (
                      <div className="flex items-start gap-2">
                        <FileKey className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--muted-foreground)] block">Issuer</span>
                          <span className="text-sm font-mono text-[var(--foreground)] break-all">{getCertField("issuer")}</span>
                        </div>
                      </div>
                    )}
                    {getCertField("serial") && (
                      <div className="flex items-start gap-2">
                        <Fingerprint className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--muted-foreground)] block">Serial</span>
                          <span className="text-sm font-mono text-[var(--foreground)] break-all">{getCertField("serial")}</span>
                        </div>
                      </div>
                    )}
                    {(getCertField("notBefore") || getCertField("notAfter")) && (
                      <div className="flex items-start gap-2">
                        <Calendar className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--muted-foreground)] block">Validity</span>
                          <div className="text-sm font-mono text-[var(--foreground)]">
                            {getCertField("notBefore") && <span className="block">From: {getCertField("notBefore")}</span>}
                            {getCertField("notAfter") && <span className="block">Until: {getCertField("notAfter")}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                    {getCertArray("subjectAltName").length > 0 && (
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-3 h-3 text-[var(--muted-foreground)] mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-[var(--muted-foreground)] block">Subject Alt Names</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {getCertArray("subjectAltName").map((san) => (
                              <Badge key={`san-${san}`} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                                {san}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  )
}
