"use client"

import Image from "next/image"
import { useState } from "react"
import { FileText, Fingerprint, Globe, Lock } from "lucide-react"

import type { TlsFingerprintsSection } from "@/lib/server/scans/scan-detail-view-model"
import { cn } from "@/lib/utils"

import {
  SectionPanel,
  SectionTitle,
  SummaryStrip,
  SummaryTile,
  insetPanelClass,
  insetRowDividerClass,
  isLocalImagePath,
  resolveFaviconPreviewSrc,
} from "./shared"

export function TlsCertificateSection({ tls }: { tls: TlsFingerprintsSection }) {
  const cert = tls.certificate

  const getCertField = (field: string): string | undefined => {
    const value = cert?.[field]
    if (typeof value === "string") return value
    return undefined
  }

  const getCertArray = (field: string): string[] => {
    const value = cert?.[field]
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string")
    }
    return []
  }

  const sanCount = getCertArray("subject_alt_name").length
  const hasCert = Boolean(cert && Object.keys(cert).length > 0)

  const summaryTiles = [
    { icon: Globe, label: "SNI", value: tls.sni ?? "N/A" },
    { icon: Fingerprint, label: "JARM Hash", value: tls.jarmHash ?? "N/A", valueClassName: "text-xs break-all" },
    ...(getCertField("tls_version") ? [{ icon: Lock, label: "TLS Version", value: getCertField("tls_version") as string }] : []),
    ...(getCertField("serial") ? [{ icon: FileText, label: "Serial", value: getCertField("serial") as string }] : []),
  ]

  return (
    <SectionPanel
      title="TLS Certificate"
      icon={Lock}
      description="Server certificate, TLS handshake metadata, and any extra subjects/issuers observed during the scan."
    >
      <div className="space-y-5">
        {/* Summary strip */}
        <SummaryStrip tiles={summaryTiles} variant="soft" />

        {/* Certificate Details */}
        {hasCert ? (
          <div className="space-y-2">
            <SectionTitle>Certificate Details</SectionTitle>
            <div className="grid gap-4 rounded-lg bg-[var(--surface-mid)]/10 px-4 py-4 ring-1 ring-white/5 sm:grid-cols-2">
              {getCertField("subject") ? (
                <div className="min-w-0">
                  <p className="mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Subject</p>
                  <p className="break-all font-mono text-sm text-[var(--foreground)]">{getCertField("subject")}</p>
                </div>
              ) : null}
              {getCertField("issuer") ? (
                <div className="min-w-0">
                  <p className="mb-1 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Issuer</p>
                  <p className="break-all font-mono text-sm text-[var(--foreground)]">{getCertField("issuer")}</p>
                </div>
              ) : null}
              {(getCertField("not_before") || getCertField("not_after")) && (
                <TlsValidity
                  notBefore={getCertField("not_before") ?? null}
                  notAfter={getCertField("not_after") ?? null}
                />
              )}
              {sanCount > 0 ? (
                <div className="min-w-0 sm:col-span-2">
                  <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    Subject Alt Names <span className="text-[var(--muted-foreground)]/60">· {sanCount}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {getCertArray("subject_alt_name").map((san) => (
                      <span
                        key={san}
                        className="rounded border border-[var(--gray-border)]/35 bg-[var(--background)]/40 px-2 py-1 font-mono text-xs text-[var(--foreground)]"
                      >
                        {san}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* SSL DNS Names (Nuclei) */}
        {tls.sslDnsNames.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={tls.sslDnsNames.reduce((acc, f) => acc + f.subjectAltNames.length, 0)}>
              SSL DNS Names (Nuclei)
            </SectionTitle>
            <div className={cn(insetPanelClass, "p-3")}>
              <div className="flex flex-wrap gap-1.5">
                {tls.sslDnsNames.flatMap((finding) =>
                  finding.subjectAltNames.map((san) => (
                    <span
                      key={`${finding.matchedAt}-${san}`}
                      className="rounded border border-[var(--accent)]/35 bg-[var(--accent)]/5 px-2 py-1 font-mono text-xs text-[var(--accent)]"
                    >
                      {san}
                    </span>
                  )),
                )}
              </div>
            </div>
          </div>
        )}

        {/* SSL Issuers (Nuclei) */}
        {tls.sslIssuers.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={tls.sslIssuers.length}>SSL Issuers (Nuclei)</SectionTitle>
            <div className={insetPanelClass}>
              {tls.sslIssuers.map((finding) => (
                <div key={`${finding.matchedAt}-${finding.issuer}`} className={cn("px-3 py-2 font-mono text-sm text-[var(--foreground)]", insetRowDividerClass)}>
                  {finding.issuer}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

function TlsValidity({ notBefore, notAfter }: { notBefore: string | null; notAfter: string | null }) {
  const startLabel = notBefore
    ? new Date(notBefore).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const endLabel = notAfter
    ? new Date(notAfter).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—"
  const [daysLeft] = useState<number | null>(() => {
    if (!notAfter) {
      return null
    }
    const expiry = Date.parse(notAfter)
    if (Number.isNaN(expiry)) {
      return null
    }
    return Math.round((expiry - Date.now()) / (1000 * 60 * 60 * 24))
  })
  const isExpiringSoon = daysLeft !== null && daysLeft < 30
  const dayLabelClass = isExpiringSoon ? "text-amber-300" : "text-[var(--foreground)]"

  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="mb-2 font-heading text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Validity</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:pr-4 sm:after:absolute sm:after:inset-y-1 sm:after:right-0 sm:after:w-px sm:after:bg-[var(--gray-border)]/16">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Issued</p>
          <p className="mt-1 font-mono text-[13px] text-[var(--foreground)]">{startLabel}</p>
        </div>
        <div className="relative sm:px-4 sm:after:absolute sm:after:inset-y-1 sm:after:right-0 sm:after:w-px sm:after:bg-[var(--gray-border)]/16">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Expires</p>
          <p className={cn("mt-1 font-mono text-[13px]", dayLabelClass)}>{endLabel}</p>
        </div>
        <div className="sm:pl-4">
          <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">Days Left</p>
          <p className={cn("mt-1 font-mono text-[13px]", dayLabelClass)}>
            {daysLeft !== null ? daysLeft.toLocaleString() : "—"}
          </p>
        </div>
      </div>
    </div>
  )
}


export function FingerprintsSection({ tls }: { tls: TlsFingerprintsSection }) {
  const hashEntries = Object.entries(tls.hashes).filter(([, value]) => value && value !== "N/A")
  const faviconPreviewSrc = resolveFaviconPreviewSrc(tls.favicon)
  const faviconDisplayValue = faviconPreviewSrc ?? tls.favicon.path ?? tls.favicon.url

  const summaryTiles = [
    { icon: Fingerprint, label: "Favicon MMH3", value: tls.favicon.mmh3 ?? "N/A" },
    { icon: Fingerprint, label: "Favicon MD5", value: tls.favicon.md5 ?? "N/A" },
  ]

  return (
    <SectionPanel
      title="Fingerprints"
      icon={Fingerprint}
      description="Stable content and favicon hashes that can be used to identify this site or match it against other Stackray scans."
    >
      <div className="space-y-5">
        {/* Favicon preview + URL */}
        {faviconDisplayValue ? (
          <div className={cn(insetPanelClass, "flex items-start gap-4 p-3")}>
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--gray-border)]/45 bg-[var(--surface-mid)] ring-1 ring-white/5">
              {faviconPreviewSrc ? (
                isLocalImagePath(faviconPreviewSrc) ? (
                  <Image
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny external favicon previews are intentionally rendered without next/image optimization
                  <img
                    src={faviconPreviewSrc}
                    alt="Favicon"
                    width={40}
                    height={40}
                    className="object-contain"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = "none"
                    }}
                  />
                )
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted-foreground)]">No preview</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                Favicon URL
              </p>
              <p className="break-all font-mono text-sm text-[var(--foreground)]">
                {faviconDisplayValue}
              </p>
            </div>
          </div>
        ) : null}

        {/* Favicon hashes as summary tiles */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {summaryTiles.map((tile) => (
            <SummaryTile
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
            />
          ))}
        </div>

        {/* Content Hashes */}
        {hashEntries.length > 0 && (
          <div className="space-y-3">
            <SectionTitle count={hashEntries.length}>Content Hashes</SectionTitle>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {hashEntries.map(([hashType, hashValue]) => (
                <div key={hashType} className={cn(insetPanelClass, "p-3")}>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    {hashType}
                  </p>
                  <p className="break-all font-mono text-xs text-[var(--foreground)]">{hashValue}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  )
}

// Domain Info Section
