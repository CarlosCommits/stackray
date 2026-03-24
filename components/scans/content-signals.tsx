"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Globe, Shield, Eye, Hash } from "lucide-react"

interface ContentSignalsProps {
  contentLength: number
  bodyPreview: string
  bodyDomains: string[]
  bodyFqdns: string[]
  hashes: Record<string, string>
}

export function ContentSignals({ contentLength, bodyPreview, bodyDomains, bodyFqdns, hashes }: ContentSignalsProps) {
  const extractedDomains = bodyDomains.length + bodyFqdns.length

  // Get hash entries for display
  const hashEntries = Object.entries(hashes).filter(([, value]) => value && value !== "N/A")

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <FileText className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <CardTitle className="text-base font-bold text-[var(--foreground)]">
            Content Signals
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-dim)]">
            Size, domains and hashes
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-end pb-3 border-b border-[var(--gray-border)]/10">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[var(--text-dim)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">Content Size</span>
          </div>
          <span className="text-xl font-bold text-[var(--foreground)] data-value">
            {contentLength.toLocaleString()}
            <span className="text-sm font-medium text-[var(--text-dim)] ml-1">bytes</span>
          </span>
        </div>

        {bodyPreview && (
          <div className="pb-3 border-b border-[var(--gray-border)]/10">
            <div className="flex items-center gap-1.5 mb-2">
              <Eye className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              <span className="text-sm font-medium text-[var(--foreground)]">Body Preview</span>
            </div>
            <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
              <CardContent className="p-3">
                <p className="text-xs text-[var(--foreground)] line-clamp-3">
                  {bodyPreview}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="pb-3 border-b border-[var(--gray-border)]/10">
          <div className="flex items-center gap-1.5 mb-2">
            <Globe className="w-3.5 h-3.5 text-[var(--text-dim)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">Extracted Domains</span>
            <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs font-bold px-2 py-0.5">
              {extractedDomains}
            </Badge>
          </div>

          {bodyDomains.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-[var(--text-dim)] block mb-1">Domains</span>
              <div className="flex flex-wrap gap-1">
                {bodyDomains.map((domain) => (
                  <Badge key={`domain-${domain}`} variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)] text-xs">
                    {domain}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {bodyFqdns.length > 0 && (
            <div>
              <span className="text-xs text-[var(--text-dim)] block mb-2">FQDNs</span>
              <div className="flex flex-wrap gap-1">
                {bodyFqdns.map((fqdn) => (
                  <Badge key={`fqdn-${fqdn}`} variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)] text-xs">
                    {fqdn}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-[var(--text-dim)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              Content Hashes
            </span>
          </div>
          <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardContent className="p-3 space-y-2">
              {hashEntries.length > 0 ? (
                hashEntries.map(([hashType, hashValue], index) => (
                  <div key={`hash-${hashType}`}>
                    {index > 0 && <Separator className="bg-[var(--gray-border)]/10 my-2" />}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs">
                      <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs uppercase shrink-0">
                        {hashType}
                      </Badge>
                      <span className="font-mono text-[var(--foreground)] break-all">
                        {hashValue}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
                  <Hash className="w-3 h-3" />
                  <span>No hashes available</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
