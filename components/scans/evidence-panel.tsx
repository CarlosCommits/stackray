"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Fingerprint, Hash, ShieldCheck } from "lucide-react"

interface EvidencePanelProps {
  tls: {
    sni: string
    jarmHash: string
    certificate?: {
      issuer?: string
      expiry?: string
      valid?: boolean
    }
  }
  favicon: {
    mmh3: string
    md5: string
    url: string
  }
}

export function EvidencePanel({ tls, favicon }: EvidencePanelProps) {
  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Fingerprint className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div>
          <CardTitle className="text-base font-bold text-[var(--foreground)]">
            Fingerprints
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-dim)]">
            TLS and favicon hashes
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Hash className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              JARM Hash
            </span>
          </div>
          <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs font-mono break-all text-[var(--foreground)]">
                {tls.jarmHash}
              </p>
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Fingerprint className="w-4 h-4 text-[var(--text-dim)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              Favicon MD5
            </span>
          </div>
          <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
            <CardContent className="p-3">
              <p className="text-xs font-mono break-all text-[var(--foreground)]">
                {favicon.md5}
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-[var(--gray-border)]/20" />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              Certificate
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
              Verified
            </Badge>
            <span className="text-sm font-medium text-[var(--foreground)]">{tls.sni}</span>
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            SNI: {tls.sni}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
