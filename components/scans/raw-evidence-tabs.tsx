"use client"

import { useState } from "react"
import { Terminal, Shield, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { NucleiSchema } from "@/lib/contracts/scans"

interface RawEvidenceTabsProps {
  rawHttpx: Record<string, unknown>
  nuclei: NucleiSchema
  scanId: string
  target: string
}

function formatJsonLines(data: unknown): { line: string; key: string }[] {
  const lines = JSON.stringify(data, null, 2).split("\n")
  const lineOccurrences = new Map<string, number>()

  return lines.map((line) => {
    const lineHash = line.trim().slice(0, 16) || "empty"
    const nextOccurrence = (lineOccurrences.get(lineHash) ?? 0) + 1
    lineOccurrences.set(lineHash, nextOccurrence)

    return {
      line,
      key: `line-${lineHash}-${nextOccurrence}`,
    }
  })
}

function getLineColor(line: string): string {
  if (line.includes('"')) {
    if (line.includes('":')) return "text-[var(--accent)]"
    return "text-[var(--foreground)]"
  }
  if (line.match(/:\s*(true|false)/)) {
    return line.includes("true") ? "text-emerald-400" : "text-red-400"
  }
  if (line.match(/:\s*\d+/)) return "text-[var(--accent)]"
  if (line.includes("{") || line.includes("}")) return "text-[var(--accent)]"
  return "text-[var(--foreground)]"
}

function JsonViewer({ data, title, icon: Icon, scanId, target, badge }: {
  data: unknown
  title: string
  icon: React.ElementType
  scanId: string
  target: string
  badge?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const formattedJson = JSON.stringify(data, null, 2)
  const keyedLines = formatJsonLines(data)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-[var(--gray-border)]/30 bg-[var(--gray-charcoal)]/50 shadow-none overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between px-5 py-4 bg-[var(--surface-dark)] hover:bg-[var(--surface-mid)] transition-colors cursor-pointer border-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-[var(--accent)]/15">
                <Icon className="size-4 text-[var(--accent)]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">{title}</span>
                  <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)]/60 text-xs font-mono">
                    {keyedLines.length} lines
                  </Badge>
                  {badge}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]/70">
                  <span className="font-mono">{scanId}</span>
                  <span>•</span>
                  <span className="truncate max-w-[220px]">{target}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOpen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy()
                  }}
                  className="h-8 px-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  {copied ? (
                    <Check className="size-4 mr-1.5" />
                  ) : (
                    <Copy className="size-4 mr-1.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
              <div className="p-1 rounded-md bg-[var(--gray-border)]/20">
                {isOpen ? (
                  <ChevronUp className="size-4 text-[var(--muted-foreground)]" />
                ) : (
                  <ChevronDown className="size-4 text-[var(--muted-foreground)]" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-5 font-mono text-sm leading-relaxed">
                <pre className="text-[var(--foreground)]">
                  {keyedLines.map(({ line, key }) => (
                    <div key={key} className={getLineColor(line)}>
                      {line}
                    </div>
                  ))}
                </pre>
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>

        {!isOpen && (
          <CardContent className="px-5 py-3 bg-[var(--gray-charcoal)]/30 border-t border-[var(--gray-border)]/20">
            <p className="text-sm text-[var(--muted-foreground)]">
              Click to expand and view the complete payload
            </p>
          </CardContent>
        )}
      </Card>
    </Collapsible>
  )
}

export function RawEvidenceTabs({ rawHttpx, nuclei, scanId, target }: RawEvidenceTabsProps) {
  const findingCount = nuclei.findings.length
  const technologyCount = nuclei.technologies.length

  return (
    <section className="scan-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Terminal className="size-5 text-[var(--accent)]" />
        </div>
        <h2 className="scan-section-title">Debug / Raw Evidence</h2>
      </div>

      <Tabs defaultValue="httpx" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="httpx" className="gap-2">
            <Terminal className="size-4" />
            HTTPX Probe
          </TabsTrigger>
          <TabsTrigger value="nuclei" className="gap-2">
            <Shield className="size-4" />
            Nuclei Security
            {findingCount > 0 && (
              <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs ml-1">
                {findingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="httpx" className="mt-4">
          <JsonViewer
            data={rawHttpx}
            title="HTTPX Probe Payload"
            icon={Terminal}
            scanId={scanId}
            target={target}
          />
        </TabsContent>

        <TabsContent value="nuclei" className="mt-4">
          <JsonViewer
            data={nuclei}
            title="Nuclei Security Payload"
            icon={Shield}
            scanId={scanId}
            target={target}
            badge={
              <>
                {findingCount > 0 && (
                  <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                    {findingCount} findings
                  </Badge>
                )}
                {technologyCount > 0 && (
                  <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                    {technologyCount} tech matches
                  </Badge>
                )}
              </>
            }
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
