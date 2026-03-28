"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Shield, AlertCircle, CheckCircle, Clock, XCircle, MinusCircle, Zap, FileCode, Target, AlertTriangle } from "lucide-react"
import type { NucleiSchema, NucleiMatch } from "@/lib/contracts/scans"

interface NucleiEvidencePanelProps {
  nuclei: NucleiSchema
}

type FindingKind = "dns_service" | "ssl_dns_names" | "ssl_issuer" | string

interface GroupedFindings {
  kind: FindingKind
  findings: NucleiMatch[]
}

const stateConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  not_run: { label: "Not Run", icon: <MinusCircle className="w-3.5 h-3.5" />, variant: "secondary" },
  pending: { label: "Pending", icon: <Clock className="w-3.5 h-3.5" />, variant: "secondary" },
  running: { label: "Running", icon: <Zap className="w-3.5 h-3.5" />, variant: "default" },
  completed: { label: "Completed", icon: <CheckCircle className="w-3.5 h-3.5" />, variant: "default" },
  failed: { label: "Failed", icon: <XCircle className="w-3.5 h-3.5" />, variant: "destructive" },
  skipped: { label: "Skipped", icon: <AlertCircle className="w-3.5 h-3.5" />, variant: "outline" },
}

const kindLabels: Record<string, string> = {
  dns_service: "DNS Services",
  ssl_dns_names: "SSL DNS Names",
  ssl_issuer: "SSL Issuer",
}

function groupFindingsByKind(findings: NucleiMatch[]): GroupedFindings[] {
  const groups = new Map<FindingKind, NucleiMatch[]>()

  for (const finding of findings) {
    const kind = finding.findingKind
    if (!groups.has(kind)) {
      groups.set(kind, [])
    }
    groups.get(kind)!.push(finding)
  }

  return Array.from(groups.entries())
    .map(([kind, items]) => ({ kind, findings: items }))
    .sort((a, b) => a.kind.localeCompare(b.kind))
}

function formatKindLabel(kind: string): string {
  return kindLabels[kind] || kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function NucleiEvidencePanel({ nuclei }: NucleiEvidencePanelProps) {
  const { state, run, findings } = nuclei
  const stateInfo = stateConfig[state] || stateConfig.not_run

  const groupedFindings = groupFindingsByKind(findings)
  const hasFindings = groupedFindings.length > 0

  if (state === "not_run" && !hasFindings) {
    return null
  }

  return (
    <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-[var(--gray-border)]/20 bg-[var(--surface-mid)]/30">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Shield className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-[var(--foreground)]">
              Nuclei Evidence
            </CardTitle>
            <Badge variant={stateInfo.variant} className="text-xs">
              <span className="flex items-center gap-1">
                {stateInfo.icon}
                {stateInfo.label}
              </span>
            </Badge>
          </div>
          <CardDescription className="text-xs text-[var(--text-dim)]">
            Security findings and service detection
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {run && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[var(--text-dim)]" />
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                Run Details
              </span>
            </div>
            <div className="text-xs space-y-1">
              {(run.targetUrl || run.targetHost) && (
                <p className="text-[var(--text-dim)]">
                  Target: <span className="text-[var(--foreground)] font-mono">{run.targetUrl || run.targetHost}</span>
                </p>
              )}
              {run.templateIds.length > 0 && (
                <p className="text-[var(--text-dim)]">
                  Templates: <span className="text-[var(--foreground)]">{run.templateIds.length}</span>
                </p>
              )}
              {(run.engineVersion || run.templatesVersion) && (
                <p className="text-[var(--text-dim)]">
                  Versions: {run.engineVersion && <span className="text-[var(--foreground)]">engine {run.engineVersion}</span>}
                  {run.engineVersion && run.templatesVersion && <span className="text-[var(--text-dim)]">, </span>}
                  {run.templatesVersion && <span className="text-[var(--foreground)]">templates {run.templatesVersion}</span>}
                </p>
              )}
            </div>
            {run.errorMessage && (
              <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">{run.errorMessage}</p>
              </div>
            )}
          </div>
        )}

        {run && hasFindings && <Separator className="bg-[var(--gray-border)]/20" />}

        {hasFindings ? (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                Findings
              </span>
              <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                {findings.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {groupedFindings.map(({ kind, findings: kindFindings }) => (
                <div key={kind} className="space-y-2">
                  <h4 className="text-xs font-medium text-[var(--foreground)]">
                    {formatKindLabel(kind)}
                  </h4>
                  <div className="space-y-2">
                    {kindFindings.map((finding) => (
                      <Card
                        key={finding.matchId}
                        className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none"
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[var(--foreground)] truncate">
                                {finding.templateId}
                              </p>
                              {finding.matchedAt && (
                                <p className="text-xs text-[var(--text-dim)] font-mono truncate">
                                  {finding.matchedAt}
                                </p>
                              )}
                            </div>
                            {finding.severity && (
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${
                                  finding.severity === "critical" || finding.severity === "high"
                                    ? "border-red-400/50 text-red-400"
                                    : finding.severity === "medium"
                                      ? "border-yellow-400/50 text-yellow-400"
                                      : finding.severity === "low"
                                        ? "border-blue-400/50 text-blue-400"
                                        : "border-[var(--gray-border)] text-[var(--text-dim)]"
                                }`}
                              >
                                {finding.severity}
                              </Badge>
                            )}
                          </div>

                          {finding.extractedResults.length > 0 && (
                            <div className="pt-2 border-t border-[var(--gray-border)]/10">
                              <p className="text-xs text-[var(--text-dim)] mb-1">Extracted:</p>
                              <div className="flex flex-wrap gap-1">
                                {finding.extractedResults.map((result: string, idx: number) => (
                                  <Badge
                                    key={`${finding.matchId}-extracted-${result}-${idx}`}
                                    variant="outline"
                                    className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-xs font-mono"
                                  >
                                    {result}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {finding.matcherName && (
                            <p className="text-xs text-[var(--text-dim)]">
                              Matcher: <span className="text-[var(--foreground)]">{finding.matcherName}</span>
                            </p>
                          )}

                          {(finding.host || finding.port || finding.scheme) && (
                            <p className="text-xs text-[var(--text-dim)] font-mono">
                              {finding.scheme && `${finding.scheme}://`}
                              {finding.host}
                              {finding.port && `:${finding.port}`}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : state === "completed" ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-dim)]">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>No findings detected</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
