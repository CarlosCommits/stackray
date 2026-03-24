"use client"

import { Terminal, ChevronDown, ChevronUp, Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"

interface RawPayloadViewerProps {
  rawHttpx: Record<string, unknown>
  scanId: string
  target: string
}

export function RawPayloadViewer({ rawHttpx, scanId, target }: RawPayloadViewerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const formattedJson = JSON.stringify(
    {
      scan_id: scanId,
      target: target,
      timestamp: rawHttpx.timestamp || new Date().toISOString(),
      analysis: {
        engine_version: "4.0.8-alpha",
        execution_time_ms: 1402,
        modules_loaded: ["tls", "waf_detect", "stack_trace"],
      },
      fingerprints: {
        jarm: rawHttpx.jarm || "N/A",
        favicon: rawHttpx.favicon_mmh3 || "N/A",
      },
      infrastructure: {
        webserver: rawHttpx.webserver || "N/A",
        tech: rawHttpx.tech || [],
      },
      raw: rawHttpx,
    },
    null,
    2
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = formattedJson.split("\n")

  const getLineColor = (line: string) => {
    if (line.includes('"')) {
      if (line.includes('":')) return "text-[var(--accent)]"
      return "text-[#c4b5a6]"
    }
    if (line.match(/:\s*(true|false)/)) {
      return line.includes("true") ? "text-green-400" : "text-red-400"
    }
    if (line.match(/:\s*\d+/)) return "text-[var(--accent)]"
    if (line.includes("{") || line.includes("}")) return "text-[var(--accent)]"
    return "text-[#c4b5a6]"
  }

  let counter = 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-[var(--gray-border)]/30 bg-[var(--gray-charcoal)]/50 shadow-none overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between px-5 py-4 bg-[var(--surface-dark)] hover:bg-[var(--surface-mid)] transition-colors cursor-pointer border-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-[var(--text-dim)]/10">
                <Terminal className="w-4 h-4 text-[var(--text-dim)]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--text-dim)]">Raw Payload Data</span>
                <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)]/60 text-xs font-mono">
                  {lines.length} lines
                </Badge>
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
                  className="h-8 px-2 text-xs text-[var(--text-dim)] hover:text-[var(--foreground)]"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-1.5" />
                  ) : (
                    <Copy className="w-4 h-4 mr-1.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
              <div className="p-1 rounded-md bg-[var(--gray-border)]/20">
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-[var(--text-dim)]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[var(--text-dim)]" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-5 font-mono text-xs leading-relaxed max-h-[500px] overflow-y-auto">
            <pre className="text-[#c4b5a6]">
              {lines.map((line) => {
                counter += 1
                return (
                  <div key={`payload-line-${counter}-${line.slice(0, 8)}`} className={getLineColor(line)}>
                    {line}
                  </div>
                )
              })}
            </pre>
          </CardContent>
        </CollapsibleContent>

        {!isOpen && (
          <CardContent className="px-5 py-3 bg-[var(--gray-charcoal)]/30 border-t border-[var(--gray-border)]/20">
            <p className="text-xs text-[var(--text-dim)]">
              Click to expand and view the complete raw scan payload
            </p>
          </CardContent>
        )}
      </Card>
    </Collapsible>
  )
}
