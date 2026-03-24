"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FileText, Globe, Shield } from "lucide-react"

interface ContentSignalsProps {
  contentLength: number
  bodyDomains: string[]
  bodyFqdns: string[]
  hashes: {
    md5: string
    sha256: string
  }
}

export function ContentSignals({ contentLength, bodyDomains, bodyFqdns, hashes }: ContentSignalsProps) {
  const extractedDomains = bodyDomains.length + bodyFqdns.length

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

      <CardContent className="p-6 space-y-5">
        <div className="flex justify-between items-end pb-4 border-b border-[var(--gray-border)]/10">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">Content Size</span>
          </div>
          <span className="text-xl font-bold text-[var(--foreground)] data-value">
            {contentLength.toLocaleString()}
            <span className="text-sm font-medium text-[var(--text-dim)] ml-1">bytes</span>
          </span>
        </div>

        <div className="flex justify-between items-end pb-4 border-b border-[var(--gray-border)]/10">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">Extracted Domains</span>
          </div>
          <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xl font-bold px-3 py-1">
            {extractedDomains}
          </Badge>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              Content Hashes
            </span>
          </div>
          <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardContent className="p-3 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                  MD5
                </Badge>
                <span className="font-mono text-[var(--foreground)] truncate max-w-[160px]">
                  {hashes.md5.slice(0, 16)}...
                </span>
              </div>
              <Separator className="bg-[var(--gray-border)]/10" />
              <div className="flex justify-between items-center text-xs">
                <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                  SHA256
                </Badge>
                <span className="font-mono text-[var(--foreground)] truncate max-w-[160px]">
                  {hashes.sha256.slice(0, 16)}...
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
