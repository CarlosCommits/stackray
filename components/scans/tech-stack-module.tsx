"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Cpu, Layers, Puzzle } from "lucide-react"

interface TechStackModuleProps {
  technologies: string[]
  wordpress?: {
    plugins?: string[]
    themes?: string[]
  } | null
}

export function TechStackModule({ technologies, wordpress }: TechStackModuleProps) {
  const primaryTech = technologies.slice(0, 2)
  const secondaryTech = technologies.slice(2)

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
          {technologies.length} detected
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {primaryTech.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">
                Primary Technologies
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {primaryTech.map((tech) => (
                <div
                  key={tech}
                  className="flex items-center justify-between bg-[var(--gray-charcoal)] rounded-md px-4 py-3 border border-[var(--gray-border)]/10"
                >
                  <span className="text-sm font-bold text-[var(--foreground)]">{tech}</span>
                  <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                    detected
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {secondaryTech.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Puzzle className="w-4 h-4 text-[var(--text-dim)]" />
              <h3 className="text-sm font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                Additional Findings
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {secondaryTech.map((tech) => (
                <Badge
                  key={tech}
                  variant="outline"
                  className="border-[var(--gray-border)] text-[var(--foreground)] text-xs px-3 py-1.5 bg-[var(--surface-mid)]"
                >
                  {tech}
                </Badge>
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
              {wordpress.plugins.map((plugin) => (
                <Badge
                  key={plugin}
                  variant="outline"
                  className="border-[var(--accent)]/40 text-[var(--accent)] text-xs px-2.5 py-1"
                >
                  {plugin}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {primaryTech.length === 0 && secondaryTech.length === 0 && !wordpress?.plugins?.length && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--text-dim)]">No technologies detected</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
