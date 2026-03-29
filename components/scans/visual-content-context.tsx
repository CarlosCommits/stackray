"use client"

import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Monitor, FileText, Globe, Eye, Hash } from "lucide-react"

interface VisualContentContextProps {
  target: string
  screenshot: {
    available: boolean
    path: string | null
    contentType: string | null
    byteSize: number | null
    capturedAt: string | null
  }
  contentLength: number
  bodyPreview: string
  bodyDomains: string[]
  bodyFqdns: string[]
  hashes: Record<string, string>
  title: string
}

function formatByteSize(byteSize: number | null) {
  if (byteSize === null) return null
  if (byteSize < 1024) return `${byteSize} B`
  if (byteSize < 1024 * 1024) return `${Math.round(byteSize / 1024)} KB`
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`
}

export function VisualContentContext({
  target,
  screenshot,
  contentLength,
  bodyPreview,
  bodyDomains,
  bodyFqdns,
  hashes,
  title,
}: VisualContentContextProps) {
  const formattedSize = formatByteSize(screenshot.byteSize)
  const formattedCapturedAt = screenshot.capturedAt ? new Date(screenshot.capturedAt).toLocaleString() : null
  const extractedDomains = bodyDomains.length + bodyFqdns.length
  const hashEntries = Object.entries(hashes).filter(([, value]) => value && value !== "N/A")

  return (
    <section className="scan-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Monitor className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <h2 className="scan-section-title">Visual & Content Context</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Screenshot */}
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
              <Monitor className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="scan-panel-title">Homepage Screenshot</CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]">
                Headless capture of the final landing page
              </p>
            </div>
            {screenshot.available && (
              <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs shrink-0">
                available
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {screenshot.available && screenshot.path ? (
              <>
                <div className="overflow-hidden rounded-lg border border-[var(--gray-border)]/20 bg-[var(--gray-charcoal)]/60">
                  <Image
                    src={screenshot.path}
                    alt={`Homepage screenshot for ${target}`}
                    width={1280}
                    height={720}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-[var(--muted-foreground)]">
                  {formattedSize && <span>Size: {formattedSize}</span>}
                  {formattedCapturedAt && <span>Captured: {formattedCapturedAt}</span>}
                  {screenshot.contentType && <span>Type: {screenshot.contentType}</span>}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--gray-border)]/30 bg-[var(--gray-charcoal)]/40 px-4 py-12 text-center">
                <Monitor className="w-8 h-8 text-[var(--muted-foreground)]/40 mx-auto mb-3" />
                <p className="text-[var(--muted-foreground)]">Screenshot capture not available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Signals */}
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="scan-panel-title">Content Signals</CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]">
                Size, preview and extracted data
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Content Size */}
            <div className="flex justify-between items-end pb-3 border-b border-[var(--gray-border)]/10">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-base font-medium text-[var(--foreground)]">Content Size</span>
              </div>
              <span className="text-2xl font-bold text-[var(--foreground)] data-value">
                {contentLength.toLocaleString()}
                <span className="text-base font-normal text-[var(--muted-foreground)] ml-1">bytes</span>
              </span>
            </div>

            {/* Page Title */}
            {title && (
              <div className="pb-3 border-b border-[var(--gray-border)]/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span className="text-base font-medium text-[var(--foreground)]">Page Title</span>
                </div>
                <p className="text-base text-[var(--foreground)] leading-relaxed">{title}</p>
              </div>
            )}

            {/* Body Preview */}
            {bodyPreview && (
              <div className="pb-3 border-b border-[var(--gray-border)]/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye className="w-4 h-4 text-[var(--muted-foreground)]" />
                  <span className="text-base font-medium text-[var(--foreground)]">Body Preview</span>
                </div>
                <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                  <CardContent className="p-3">
                    <p className="text-sm text-[var(--foreground)] line-clamp-4">
                      {bodyPreview}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Extracted Domains */}
            <div className="pb-3 border-b border-[var(--gray-border)]/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Globe className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-base font-medium text-[var(--foreground)]">Extracted Domains</span>
                <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs font-bold px-2 py-0.5">
                  {extractedDomains}
                </Badge>
              </div>

              {bodyDomains.length > 0 && (
                <div className="mb-2">
                  <span className="text-sm text-[var(--muted-foreground)] block mb-1">Domains</span>
                  <div className="flex flex-wrap gap-1">
                    {bodyDomains.map((domain) => (
                      <Badge key={`domain-${domain}`} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-sm">
                        {domain}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {bodyFqdns.length > 0 && (
                <div>
                  <span className="text-sm text-[var(--muted-foreground)] block mb-1">FQDNs</span>
                  <ScrollArea className="h-[100px]">
                    <div className="flex flex-wrap gap-1">
                      {bodyFqdns.map((fqdn) => (
                        <Badge key={`fqdn-${fqdn}`} variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-sm">
                          {fqdn}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            {/* Content Hashes */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="w-4 h-4 text-[var(--muted-foreground)]" />
                <span className="text-sm font-semibold text-[var(--muted-foreground)]">Content Hashes</span>
              </div>
              <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                <CardContent className="p-3 space-y-2">
                  {hashEntries.length > 0 ? (
                    hashEntries.map(([hashType, hashValue], index) => (
                      <div key={`hash-${hashType}`}>
                        {index > 0 && <Separator className="bg-[var(--gray-border)]/10 my-2" />}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                          <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs uppercase shrink-0">
                            {hashType}
                          </Badge>
                          <span className="font-mono text-sm text-[var(--foreground)] break-all">
                            {hashValue}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <Hash className="w-3 h-3" />
                      <span>No hashes available</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
