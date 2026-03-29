"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, FileCode, Cpu, AlertCircle, CheckCircle, Clock, XCircle, MinusCircle, Zap, Target, AlertTriangle } from "lucide-react"
import type { NucleiSchema, NucleiMatch } from "@/lib/contracts/scans"

interface ScanFindingsWorkspaceProps {
  nuclei: NucleiSchema
  technologies: string[]
  technologyItems?: Array<{ name: string; inferred: boolean }>
  wordpress?: {
    pluginItems?: Array<{ name: string; inferred: boolean }>
    plugins?: string[]
    themeItems?: Array<{ name: string; inferred: boolean }>
    themes?: string[]
  } | null
  cpe?: Array<{ cpe: string; vendor: string | null; product: string | null }>
}

type FindingKind = "domain_metadata" | "dns_service" | "ssl_dns_names" | "ssl_issuer" | "txt_record" | "nameserver_record" | "robots_txt" | "technology_match" | string

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
  domain_metadata: "Domain Metadata",
  dns_service: "DNS Services",
  ssl_dns_names: "SSL DNS Names",
  ssl_issuer: "SSL Issuer",
  txt_record: "TXT Records",
  nameserver_record: "Nameserver Records",
  robots_txt: "Robots.txt",
  technology_match: "Technology Matches",
}

const kindOrder: FindingKind[] = [
  "domain_metadata",
  "dns_service",
  "ssl_dns_names",
  "ssl_issuer",
  "txt_record",
  "nameserver_record",
  "robots_txt",
  "technology_match",
]

function groupFindingsByKind(findings: NucleiMatch[]): GroupedFindings[] {
  const groups = new Map<FindingKind, NucleiMatch[]>()

  for (const finding of findings) {
    const kind = finding.findingKind as FindingKind
    if (!groups.has(kind)) {
      groups.set(kind, [])
    }
    groups.get(kind)!.push(finding)
  }

  const sortedGroups = Array.from(groups.entries())
    .map(([kind, items]) => ({ kind, findings: items }))
    .sort((a, b) => {
      const aIndex = kindOrder.indexOf(a.kind)
      const bIndex = kindOrder.indexOf(b.kind)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.kind.localeCompare(b.kind)
    })

  return sortedGroups
}

function formatKindLabel(kind: string): string {
  return kindLabels[kind] || kind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function getSeverityColor(severity: string | null): string {
  if (!severity) return "border-[var(--gray-border)] text-[var(--muted-foreground)]"
  switch (severity.toLowerCase()) {
    case "critical":
    case "high":
      return "border-red-400/50 text-red-400"
    case "medium":
      return "border-amber-400/50 text-amber-400"
    case "low":
      return "border-blue-400/50 text-blue-400"
    default:
      return "border-[var(--gray-border)] text-[var(--muted-foreground)]"
  }
}

function SecurityFindingsPanel({ nuclei, run }: { nuclei: NucleiSchema; run: NucleiSchema["run"] }) {
  const { state, findings } = nuclei
  const stateInfo = stateConfig[state] || stateConfig.not_run

  const groupedFindings = groupFindingsByKind(findings)
  const hasFindings = groupedFindings.length > 0

  if (state === "not_run" && !hasFindings) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* Run Status Header */}
      <div className="flex items-center gap-3">
        <Badge variant={stateInfo.variant} className="text-sm">
          <span className="flex items-center gap-1.5">
            {stateInfo.icon}
            {stateInfo.label}
          </span>
        </Badge>
        {findings.length > 0 && (
          <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-sm">
            {findings.length} findings
          </Badge>
        )}
      </div>

      {/* Run Details */}
      {run && (
        <Card className="scan-panel-compact">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[var(--muted-foreground)]" />
              <span className="scan-label">Run Details</span>
            </div>
            <div className="text-sm space-y-1.5">
              {(run.targetUrl || run.targetHost) && (
                <p className="text-[var(--muted-foreground)]">
                  Target: <span className="text-[var(--foreground)] font-mono">{run.targetUrl || run.targetHost}</span>
                </p>
              )}
              {run.templateIds.length > 0 && (
                <p className="text-[var(--muted-foreground)]">
                  Templates: <span className="text-[var(--foreground)]">{run.templateIds.length}</span>
                </p>
              )}
              {(run.engineVersion || run.templatesVersion) && (
                <p className="text-[var(--muted-foreground)]">
                  Versions: {run.engineVersion && <span className="text-[var(--foreground)]">engine {run.engineVersion}</span>}
                  {run.engineVersion && run.templatesVersion && <span className="text-[var(--muted-foreground)]">, </span>}
                  {run.templatesVersion && <span className="text-[var(--foreground)]">templates {run.templatesVersion}</span>}
                </p>
              )}
            </div>
            {run.errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 mt-3">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{run.errorMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Findings by Category */}
      {hasFindings ? (
        <Accordion type="multiple" defaultValue={groupedFindings.slice(0, 3).map(g => g.kind)} className="space-y-3">
          {groupedFindings.map(({ kind, findings: kindFindings }) => (
            <AccordionItem key={kind} value={kind} className="scan-panel border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-[var(--surface-mid)]/50">
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-[var(--accent)]" />
                  <span className="scan-panel-title">{formatKindLabel(kind)}</span>
                  <Badge variant="outline" className="border-[var(--gray-border)] text-[var(--muted-foreground)] text-xs">
                    {kindFindings.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3">
                  {kindFindings.map((finding) => (
                    <Card key={finding.matchId} className="bg-[var(--gray-charcoal)] border-[var(--gray-border)]/10 shadow-none">
                      <CardContent className="p-4 space-y-3">
                        {/* Finding Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-medium text-[var(--foreground)] truncate">
                              {finding.templateId}
                            </p>
                            {finding.matchedAt && (
                              <p className="text-sm text-[var(--muted-foreground)] font-mono truncate">
                                {finding.matchedAt}
                              </p>
                            )}
                          </div>
                          {finding.severity && (
                            <Badge
                              variant="outline"
                              className={`text-sm shrink-0 ${getSeverityColor(finding.severity)}`}
                            >
                              {finding.severity}
                            </Badge>
                          )}
                        </div>

                        {/* Extracted Results */}
                        {finding.extractedResults.length > 0 && (
                          <div className="pt-3 border-t border-[var(--gray-border)]/10">
                            <p className="text-sm text-[var(--muted-foreground)] mb-2">Extracted:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {finding.extractedResults.map((result: string) => (
                                <Badge
                                  key={`${finding.matchId}-extracted-${result}`}
                                  variant="outline"
                                  className="border-[var(--gray-border)]/50 text-[var(--foreground)] text-sm font-mono py-1"
                                >
                                  {result}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {finding.matcherName && (
                            <span className="text-[var(--muted-foreground)]">
                              Matcher: <span className="text-[var(--foreground)]">{finding.matcherName}</span>
                            </span>
                          )}
                          {finding.subject && (
                            <span className="text-[var(--muted-foreground)]">
                              {finding.subjectType || "Subject"}: <span className="text-[var(--foreground)] font-mono">{finding.subject}</span>
                            </span>
                          )}
                          {(finding.host || finding.port || finding.scheme) && (
                            <span className="text-[var(--muted-foreground)] font-mono">
                              {finding.scheme && `${finding.scheme}://`}
                              {finding.host}
                              {finding.port && `:${finding.port}`}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : state === "completed" ? (
        <Card className="scan-panel-compact">
          <CardContent className="p-6 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-[var(--muted-foreground)]" />
            <span className="text-[var(--muted-foreground)]">No security findings detected</span>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function TechnologyFindingsPanel({
  technologies,
  technologyItems,
  wordpress,
  cpe,
}: {
  technologies: string[]
  technologyItems?: Array<{ name: string; inferred: boolean }>
  wordpress?: ScanFindingsWorkspaceProps["wordpress"]
  cpe?: ScanFindingsWorkspaceProps["cpe"]
}) {
  const detectedCount = technologies.length + (wordpress?.plugins?.length ?? 0) + (wordpress?.themes?.length ?? 0) + (cpe?.length ?? 0)

  const primaryTechs = technologyItems?.slice(0, 4) ?? technologies.slice(0, 4).map((name) => ({ name, inferred: false }))
  const additionalTechs = technologyItems?.slice(4) ?? technologies.slice(4).map((name) => ({ name, inferred: false }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-sm">
          {detectedCount} detected
        </Badge>
      </div>

      {/* Primary Technologies */}
      {primaryTechs.length > 0 && (
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <div className="p-1.5 rounded-md bg-[var(--accent)]/10">
              <Cpu className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <CardTitle className="scan-panel-title">Primary Technologies</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {primaryTechs.map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-center justify-between bg-[var(--gray-charcoal)] rounded-md px-4 py-3 border border-[var(--gray-border)]/10"
                >
                  <span className="text-base font-medium text-[var(--foreground)]">{tech.name}</span>
                  <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs">
                    detected
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Technologies */}
      {additionalTechs.length > 0 && (
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <CardTitle className="scan-panel-title">Additional Technologies</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {additionalTechs.map((tech) => (
                <Badge
                  key={tech.name}
                  variant="outline"
                  className="border-[var(--gray-border)] text-[var(--foreground)] text-sm px-3 py-1.5 bg-[var(--surface-mid)]"
                >
                  {tech.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WordPress Plugins */}
      {wordpress?.plugins && wordpress.plugins.length > 0 && (
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <CardTitle className="scan-panel-title">WordPress Plugins</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {(wordpress.pluginItems ?? wordpress.plugins.map((plugin) => ({ name: plugin, inferred: false }))).map((plugin) => (
                <Badge
                  key={plugin.name}
                  variant="outline"
                  className="border-[var(--accent)]/40 text-[var(--accent)] text-sm px-2.5 py-1"
                >
                  {plugin.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WordPress Themes */}
      {wordpress?.themes && wordpress.themes.length > 0 && (
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <CardTitle className="scan-panel-title">WordPress Themes</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {(wordpress.themeItems ?? wordpress.themes.map((theme) => ({ name: theme, inferred: false }))).map((theme) => (
                <Badge
                  key={theme.name}
                  variant="outline"
                  className="border-[var(--accent)]/40 text-[var(--accent)] text-sm px-2.5 py-1"
                >
                  {theme.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CPE Entries */}
      {cpe && cpe.length > 0 && (
        <Card className="scan-panel">
          <CardHeader className="scan-panel-header">
            <CardTitle className="scan-panel-title">CPE Entries</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {cpe.map((entry) => (
                  <div
                    key={entry.cpe}
                    className="flex flex-col gap-1 bg-[var(--gray-charcoal)] rounded-md px-4 py-3 border border-[var(--gray-border)]/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-[var(--foreground)]">
                        {entry.vendor && entry.product
                          ? `${entry.vendor} ${entry.product}`
                          : entry.vendor || entry.product || "Unknown Product"}
                      </span>
                    </div>
                    <code className="text-sm text-[var(--muted-foreground)] font-mono break-all">
                      {entry.cpe}
                    </code>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {detectedCount === 0 && (
        <Card className="scan-panel-compact">
          <CardContent className="p-6 text-center">
            <p className="text-[var(--muted-foreground)]">No technologies detected</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function ScanFindingsWorkspace({
  nuclei,
  technologies,
  technologyItems,
  wordpress,
  cpe,
}: ScanFindingsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("security")
  const { state, run, findings } = nuclei

  const hasSecurityContent = state !== "not_run" || findings.length > 0
  const hasTechnologyContent = technologies.length > 0 || (wordpress?.plugins?.length ?? 0) > 0 || (wordpress?.themes?.length ?? 0) > 0 || (cpe?.length ?? 0) > 0

  return (
    <section className="scan-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-md bg-[var(--accent)]/10">
          <Shield className="w-5 h-5 text-[var(--accent)]" />
        </div>
        <h2 className="scan-section-title">Findings Workspace</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security Findings
            {findings.length > 0 && (
              <Badge variant="outline" className="border-[var(--accent)]/30 text-[var(--accent)] text-xs ml-1">
                {findings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="technology" className="gap-2">
            <Cpu className="w-4 h-4" />
            Technology Stack
          </TabsTrigger>
        </TabsList>

        <TabsContent value="security" className="mt-4">
          {hasSecurityContent ? (
            <SecurityFindingsPanel nuclei={nuclei} run={run} />
          ) : (
            <Card className="scan-panel-compact">
              <CardContent className="p-6 text-center">
                <Shield className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
                <p className="text-[var(--muted-foreground)]">Security findings not available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="technology" className="mt-4">
          {hasTechnologyContent ? (
            <TechnologyFindingsPanel
              technologies={technologies}
              technologyItems={technologyItems}
              wordpress={wordpress}
              cpe={cpe}
            />
          ) : (
            <Card className="scan-panel-compact">
              <CardContent className="p-6 text-center">
                <Cpu className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-3" />
                <p className="text-[var(--muted-foreground)]">No technologies detected</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}
