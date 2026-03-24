"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowRight, Clock, Globe, Link2, MapPin, FileType, Route } from "lucide-react"

interface RedirectHop {
  url?: string
  statusCode?: number
  location?: string | null
  contentLength?: number
  responseTimeMs?: number
  [key: string]: unknown
}

interface DeliveryModuleProps {
  finalUrl: string
  path: string
  method: string
  location: string | null
  contentType: string | null
  responseTimeMs: number
  redirectChain: {
    statusCodes: number[]
    items: RedirectHop[]
  }
}

export function DeliveryModule({
  finalUrl,
  path,
  method,
  location,
  contentType,
  responseTimeMs,
  redirectChain,
}: DeliveryModuleProps) {
  const hasRedirects = redirectChain.statusCodes.length > 1
  const hopCount = redirectChain.items.length

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
    if (!code) return "text-[var(--text-dim)]"
    if (code >= 200 && code < 300) return "text-emerald-500"
    if (code >= 300 && code < 400) return "text-amber-500"
    if (code >= 400) return "text-rose-500"
    return "text-[var(--foreground)]"
  }

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[var(--accent)]/10">
            <Route className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[var(--foreground)]">
              Delivery & Redirects
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">
              Response metadata and redirect chain
            </CardDescription>
          </div>
        </div>
        {hasRedirects && (
          <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
            {hopCount - 1} redirect{hopCount - 1 !== 1 ? "s" : ""}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] uppercase tracking-wide">
              <Link2 className="w-3 h-3" />
              <span>Final URL</span>
            </div>
            <p className="text-sm font-mono text-[var(--foreground)] break-all" title={finalUrl}>
              {formatUrl(finalUrl)}
            </p>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] uppercase tracking-wide">
              <Globe className="w-3 h-3" />
              <span>Path</span>
            </div>
            <p className="text-sm font-mono text-[var(--foreground)] break-all">
              {path || "/"}
            </p>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] uppercase tracking-wide">
              <Clock className="w-3 h-3" />
              <span>Response Time</span>
            </div>
            <p className="text-sm font-bold text-[var(--foreground)]">
              {responseTimeMs}<span className="text-xs font-normal text-[var(--text-dim)] ml-1">ms</span>
            </p>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-dim)] uppercase tracking-wide">
              <FileType className="w-3 h-3" />
              <span>Content Type</span>
            </div>
            <p className="text-sm text-[var(--foreground)] break-all" title={contentType ?? undefined}>
              {contentType || "N/A"}
            </p>
          </div>
        </div>

        {location && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-[var(--gray-charcoal)] border border-[var(--gray-border)]/10">
            <MapPin className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Location Header</span>
              <p className="text-sm font-mono text-[var(--foreground)] break-all" title={location}>
                {location}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Method</span>
          <Badge 
            variant="outline" 
            className="border-[var(--accent)]/40 text-[var(--accent)] text-xs font-mono"
          >
            {method}
          </Badge>
        </div>

        <Separator className="bg-[var(--gray-border)]/10" />

        {hasRedirects ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                Redirect Chain
              </h3>
            </div>

            <div className="space-y-2">
              {redirectChain.items.map((hop, index) => {
                const isLast = index === redirectChain.items.length - 1
                const statusCode = hop.statusCode ?? redirectChain.statusCodes[index]
                const hopLocation = hop.location ?? null
                const hopKey = hop.url ? `${hop.url}-${index}` : `hop-${index}`

                return (
                  <Card 
                    key={hopKey} 
                    className={`bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none ${isLast ? "border-l-2 border-l-[var(--accent)]" : ""}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs font-mono ${getStatusColor(statusCode)} border-current`}
                          >
                            {statusCode || "—"}
                          </Badge>
                          {!isLast && (
                            <ArrowRight className="w-3 h-3 text-[var(--text-dim)] rotate-90" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-mono text-[var(--foreground)] break-all" title={hop.url}>
                            {formatUrl(hop.url)}
                          </p>

                          {hopLocation && (
                            <p className="text-xs text-[var(--text-dim)] break-all" title={hopLocation}>
                              → {hopLocation}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
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
          <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
            <Route className="w-4 h-4" />
            <span>No redirects — direct response</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
