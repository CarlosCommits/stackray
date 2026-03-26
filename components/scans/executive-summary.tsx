"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Globe, MapPin, ArrowLeftRight, Server, Shield, Tag, Layers } from "lucide-react"

interface ExecutiveSummaryProps {
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
}

export function ExecutiveSummary({
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
}: ExecutiveSummaryProps) {
  const visibleTechnologyItems = technologyItems?.slice(0, 6) ?? technologies.slice(0, 6).map((name) => ({ name, inferred: false }))
  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return "text-[var(--accent)]"
    if (code >= 300 && code < 400) return "text-blue-400"
    if (code >= 400 && code < 500) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Status</span>
            </div>
            <p className={`text-3xl font-black tracking-tight ${getStatusColor(statusCode)}`}>
              {statusCode}
            </p>
            <p className="text-sm font-medium text-[var(--text-dim)] mt-1">{statusText}</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <ArrowLeftRight className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Redirects</span>
            </div>
            <p className="text-3xl font-black tracking-tight text-[var(--foreground)]">{redirectCount}</p>
            <p className="text-sm font-medium text-[var(--text-dim)] mt-1">
              {redirectCount === 0 ? "Direct" : redirectCount === 1 ? "1 hop" : `${redirectCount} hops`}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Server className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Server</span>
            </div>
            <p className="text-xl font-bold text-[var(--foreground)] truncate">{server || "Unknown"}</p>
            <p className="text-sm font-medium text-[var(--text-dim)] mt-1">{cdnName !== "none" ? cdnName : "No CDN"}</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <MapPin className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">IPv4 Node</span>
            </div>
            <p className="text-lg font-mono font-bold text-[var(--foreground)] truncate">{hostIp}</p>
            <p className="text-sm font-medium text-[var(--text-dim)] mt-1">Resolved</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Layers className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <CardTitle className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                Detected Technologies ({technologies.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {visibleTechnologyItems.map((tech) => (
                <div key={tech.name} className="flex items-center gap-1.5">
                  <Badge 
                    variant="outline" 
                    className="border-[var(--gray-border)] text-[var(--foreground)] text-xs px-2.5 py-1 font-medium"
                  >
                    {tech.name}
                  </Badge>
                </div>
              ))}
              {technologies.length > 6 && (
                <Badge 
                  variant="outline" 
                  className="border-[var(--gray-border)] text-[var(--text-dim)] text-xs px-2.5 py-1 font-medium"
                >
                  +{technologies.length - 6} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Globe className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <CardTitle className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Final URL</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono text-[var(--foreground)] break-all leading-relaxed">
              {finalUrl}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
                <Tag className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <CardTitle className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">Page Title</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-base font-medium text-[var(--foreground)] leading-relaxed">
              {title}
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
