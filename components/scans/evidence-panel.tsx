"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Fingerprint, Hash, ShieldCheck, Lock, Calendar, Key, FileKey } from "lucide-react"

interface EvidencePanelProps {
  tls: {
    sni: string
    jarmHash: string
    certificate?: Record<string, unknown>
  }
  favicon: {
    mmh3: string
    md5: string
    url: string
    path: string
  }
}

export function EvidencePanel({ tls, favicon }: EvidencePanelProps) {
  const cert = tls.certificate

  // Helper to safely get certificate field
  const getCertField = (field: string): string | undefined => {
    const value = cert?.[field]
    if (typeof value === "string") return value
    return undefined
  }

  // Helper to safely get array field
  const getCertArray = (field: string): string[] => {
    const value = cert?.[field]
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string")
    }
    return []
  }

  const subject = getCertField("subject")
  const issuer = getCertField("issuer")
  const serial = getCertField("serial")
  const fingerprint = getCertField("fingerprint")
  const notBefore = getCertField("notBefore")
  const notAfter = getCertField("notAfter")
  const keyAlgorithm = getCertField("keyAlgorithm")
  const keySize = cert?.["keySize"]
  const signatureAlgorithm = getCertField("signatureAlgorithm")
  const version = cert?.["version"]
  const subjectAltName = getCertArray("subjectAltName")

  const hasCertificateDetails = cert && Object.keys(cert).length > 0
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

      <CardContent className="p-4 space-y-4">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Hash className="w-3.5 h-3.5 text-[var(--text-dim)]" />
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

        <Separator className="bg-[var(--gray-border)]/20" />

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Fingerprint className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              Favicon Fingerprints
            </span>
          </div>
          <div className="space-y-2">
            <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                    MMH3
                  </Badge>
                  <span className="text-xs text-[var(--text-dim)]">{favicon.path || "/favicon.ico"}</span>
                </div>
                <p className="text-xs font-mono break-all text-[var(--foreground)]">
                  {favicon.mmh3}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
                    MD5
                  </Badge>
                </div>
                <p className="text-xs font-mono break-all text-[var(--foreground)]">
                  {favicon.md5}
                </p>
              </CardContent>
            </Card>
            {favicon.url && (
              <p className="text-xs text-[var(--text-dim)] break-all">
                URL: {favicon.url}
              </p>
            )}
          </div>
        </div>

        <Separator className="bg-[var(--gray-border)]/20" />

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
              TLS Certificate
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] text-xs">
              {tls.sni ? "Verified" : "No SNI"}
            </Badge>
            <span className="text-sm font-medium text-[var(--foreground)]">{tls.sni || "N/A"}</span>
          </div>

          {hasCertificateDetails && (
            <div className="space-y-3">
              {subject && (
                <div className="flex items-start gap-2">
                  <Lock className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Subject</span>
                    <span className="text-xs font-mono text-[var(--foreground)] break-all">{subject}</span>
                  </div>
                </div>
              )}
              {issuer && (
                <div className="flex items-start gap-2">
                  <FileKey className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Issuer</span>
                    <span className="text-xs font-mono text-[var(--foreground)] break-all">{issuer}</span>
                  </div>
                </div>
              )}
              {serial && (
                <div className="flex items-start gap-2">
                  <Fingerprint className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Serial</span>
                    <span className="text-xs font-mono text-[var(--foreground)] break-all">{serial}</span>
                  </div>
                </div>
              )}
              {fingerprint && (
                <div className="flex items-start gap-2">
                  <Hash className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Fingerprint</span>
                    <span className="text-xs font-mono text-[var(--foreground)] break-all">{fingerprint}</span>
                  </div>
                </div>
              )}
              {(notBefore || notAfter) && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Validity</span>
                    <div className="text-xs font-mono text-[var(--foreground)]">
                      {notBefore && <span className="block">From: {notBefore}</span>}
                      {notAfter && <span className="block">Until: {notAfter}</span>}
                    </div>
                  </div>
                </div>
              )}
              {(keyAlgorithm || typeof keySize === "number" || signatureAlgorithm) && (
                <div className="flex items-start gap-2">
                  <Key className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Key</span>
                    <div className="text-xs font-mono text-[var(--foreground)]">
                      {keyAlgorithm && <span className="block">Algorithm: {keyAlgorithm}</span>}
                      {typeof keySize === "number" && <span className="block">Size: {keySize} bits</span>}
                      {signatureAlgorithm && <span className="block">Signature: {signatureAlgorithm}</span>}
                      {typeof version === "number" && <span className="block">Version: {version}</span>}
                    </div>
                  </div>
                </div>
              )}
              {subjectAltName.length > 0 && (
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-3 h-3 text-[var(--text-dim)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--text-dim)] block">Subject Alt Names</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {subjectAltName.map((san) => (
                        <Badge key={`san-${san}`} variant="outline" className="border-[var(--gray-border)] text-[var(--text-dim)] text-xs">
                          {san}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
