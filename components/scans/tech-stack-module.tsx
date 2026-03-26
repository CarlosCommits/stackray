"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Cpu, Layers, Puzzle, Palette, Shield } from "lucide-react"

interface CpeEntry {
  cpe: string
  vendor: string | null
  product: string | null
}

interface TechStackModuleProps {
  primaryTechnologyItems: Array<{ name: string; inferred: boolean }>
  primaryTechnologies: string[]
  additionalFindingItems: Array<{ name: string; inferred: boolean }>
  additionalFindings: string[]
  wordpress?: {
    pluginItems?: Array<{ name: string; inferred: boolean }>
    plugins?: string[]
    themeItems?: Array<{ name: string; inferred: boolean }>
    themes?: string[]
  } | null
  cpe?: CpeEntry[]
}

export function TechStackModule({ primaryTechnologyItems, primaryTechnologies, additionalFindingItems, additionalFindings, wordpress, cpe }: TechStackModuleProps) {
  const detectedCount = primaryTechnologies.length + additionalFindings.length + (wordpress?.plugins?.length ?? 0) + (wordpress?.themes?.length ?? 0)

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[var(--accent)]/10">
            <Cpu className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-[var(--foreground)]">
              Technology Stack
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-dim)]">
              Detected frameworks and platforms
            </CardDescription>
          </div>
        </div>
        <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
          {detectedCount} detected
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {primaryTechnologies.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                Primary Technologies
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {primaryTechnologyItems.map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-center justify-between bg-[var(--gray-charcoal)] rounded-md px-4 py-3 border border-[var(--gray-border)]/10"
                >
                  <span className="text-sm font-bold text-[var(--foreground)]">{tech.name}</span>
                  <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                    detected
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {additionalFindings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-4 h-4 text-[var(--text-dim)]" />
              <h3 className="text-sm font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                Additional Findings
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {additionalFindingItems.map((tech) => (
                <div key={tech.name} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[var(--gray-border)] text-[var(--foreground)] text-xs px-3 py-1.5 bg-[var(--surface-mid)]"
                  >
                    {tech.name}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {wordpress?.plugins && wordpress.plugins.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                WordPress Plugins
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(wordpress.pluginItems ?? wordpress.plugins.map((plugin) => ({ name: plugin, inferred: false }))).map((plugin) => (
                <div key={plugin.name} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[var(--accent)]/40 text-[var(--accent)] text-xs px-2.5 py-1"
                  >
                    {plugin.name}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {wordpress?.themes && wordpress.themes.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                WordPress Themes
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {(wordpress.themeItems ?? wordpress.themes.map((theme) => ({ name: theme, inferred: false }))).map((theme) => (
                <div key={theme.name} className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-[var(--accent)]/40 text-[var(--accent)] text-xs px-2.5 py-1"
                  >
                    {theme.name}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {cpe && cpe.length > 0 && (
          <div className="border-t border-[var(--gray-border)]/20 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                CPE Entries
              </h3>
            </div>
            <div className="space-y-2">
              {cpe.map((entry) => (
                <div
                  key={entry.cpe}
                  className="flex flex-col gap-1 bg-[var(--gray-charcoal)] rounded-md px-4 py-3 border border-[var(--gray-border)]/10"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--foreground)]">
                      {entry.vendor && entry.product
                        ? `${entry.vendor} ${entry.product}`
                        : entry.vendor || entry.product || "Unknown Product"}
                    </span>
                  </div>
                  <code className="text-xs text-[var(--text-dim)] font-mono break-all">
                    {entry.cpe}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {primaryTechnologies.length === 0 && additionalFindings.length === 0 && !wordpress?.plugins?.length && !wordpress?.themes?.length && !cpe?.length && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-dim)]">No technologies detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
