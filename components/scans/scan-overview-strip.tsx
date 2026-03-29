"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, ArrowLeftRight, Server, MapPin, Layers, Globe, Tag } from "lucide-react"

interface ScanOverviewStripProps {
  technologyItems?: Array<{ name: string; inferred: boolean }>
  technologies: string[]
  finalUrl: string
  redirectCount: number
  statusCode: number
  statusText?: string
  server: string | null | undefined
  cdnName: string
  hostIp: string
  title: string
  asnOrg?: string | null
}

export function ScanOverviewStrip({
  technologyItems,
  technologies,
  finalUrl,
  redirectCount,
  statusCode,
  statusText,
  server,
  cdnName,
  hostIp,
  title,
  asnOrg,
}: ScanOverviewStripProps) {
  const visibleTechnologyItems = technologyItems?.slice(0, 4) ?? technologies.slice(0, 4).map((name) => ({ name, inferred: false }))

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return "text-emerald-400"
    if (code >= 300 && code < 400) return "text-amber-400"
    if (code >= 400 && code < 500) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <section className="space-y-4">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Status</span>
            </div>
            <p className={`text-3xl font-bold tracking-tight ${getStatusColor(statusCode)}`}>
              {statusCode}
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{statusText}</p>
          </CardContent>
        </Card>

        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <ArrowLeftRight className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Redirects</span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-[var(--foreground)]">{redirectCount}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {redirectCount === 0 ? "Direct" : redirectCount === 1 ? "1 hop" : `${redirectCount} hops`}
            </p>
          </CardContent>
        </Card>

        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Server className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Server</span>
            </div>
            <p className="text-xl font-bold text-[var(--foreground)] truncate">{server || "Unknown"}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{cdnName !== "none" ? cdnName : "No CDN"}</p>
          </CardContent>
        </Card>

        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <MapPin className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">IPv4 Node</span>
            </div>
            <p className="text-lg font-mono font-bold text-[var(--foreground)] truncate">{hostIp}</p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{asnOrg || "Resolved"}</p>
          </CardContent>
        </Card>

        <Card className="scan-panel-compact md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Technologies ({technologies.length})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {visibleTechnologyItems.map((tech) => (
                <Badge
                  key={tech.name}
                  variant="outline"
                  className="border-[var(--gray-border)] text-[var(--foreground)] text-sm px-2 py-0.5 font-medium"
                >
                  {tech.name}
                </Badge>
              ))}
              {technologies.length > 4 && (
                <Badge
                  variant="outline"
                  className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-sm px-2 py-0.5 font-medium"
                >
                  +{technologies.length - 4} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Globe className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Final URL</span>
            </div>
            <p className="text-sm font-mono text-[var(--foreground)] break-all leading-relaxed">
              {finalUrl}
            </p>
          </CardContent>
        </Card>

        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Tag className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="scan-label">Page Title</span>
            </div>
            <p className="text-base font-medium text-[var(--foreground)] leading-relaxed">
              {title}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
