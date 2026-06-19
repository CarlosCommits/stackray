"use client"

import { useMemo, useState, type ElementType, type ReactNode } from "react"
import { Check, Copy, FileJson, Shield, Terminal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { NucleiSchema } from "@/lib/contracts/scans"

interface RawEvidenceTabsProps {
  rawHttpx: Record<string, unknown>
  nuclei: NucleiSchema
}

type JsonLine = {
  line: string
  key: string
}

type EvidenceRow = {
  label: string
  value: ReactNode
  muted?: boolean
}

function getJsonStats(data: unknown) {
  const json = JSON.stringify(data, null, 2)
  return {
    json,
    lines: json.split("\n").length,
    bytes: typeof Blob === "undefined" ? json.length : new Blob([json]).size,
  }
}

function formatJsonLines(data: unknown): JsonLine[] {
  const lines = JSON.stringify(data, null, 2).split("\n")
  const lineOccurrences = new Map<string, number>()

  return lines.map((line, index) => {
    const lineHash = line.trim().slice(0, 16) || "empty"
    const nextOccurrence = (lineOccurrences.get(lineHash) ?? 0) + 1
    lineOccurrences.set(lineHash, nextOccurrence)

    return {
      line,
      key: `line-${index}-${lineHash}-${nextOccurrence}`,
    }
  })
}

function getLineColor(line: string): string {
  if (/^\s*"/.test(line) && line.includes('":')) {
    return "text-primary"
  }

  if (/:\s*"(.*)"[,)]?$/.test(line)) {
    return "text-foreground"
  }

  if (/:\s*(true|false)/.test(line)) {
    return line.includes("true") ? "text-primary" : "text-destructive"
  }

  if (/:\s*-?\d+/.test(line)) {
    return "text-primary"
  }

  if (line.includes("{") || line.includes("}")) {
    return "text-muted-foreground"
  }

  return "text-foreground"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`
  }

  const mb = kb / 1024
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">Not captured</span>
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  if (typeof value === "number") {
    return value.toLocaleString()
  }

  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground">None</span>
    }

    return value.map((item) => String(item)).join(", ")
  }

  return JSON.stringify(value)
}

function getFirstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== "") {
      return value
    }
  }

  return null
}

function getHttpxRows(rawHttpx: Record<string, unknown>): EvidenceRow[] {
  return [
    { label: "Status", value: formatValue(getFirstValue(rawHttpx, ["status_code", "statusCode"])) },
    { label: "Final URL", value: formatValue(getFirstValue(rawHttpx, ["final_url", "finalUrl", "url"])) },
    { label: "Title", value: formatValue(getFirstValue(rawHttpx, ["title"])) },
    { label: "Web server", value: formatValue(getFirstValue(rawHttpx, ["webserver", "server"])) },
    { label: "Content type", value: formatValue(getFirstValue(rawHttpx, ["content_type", "contentType"])) },
    { label: "Content length", value: formatValue(getFirstValue(rawHttpx, ["content_length", "contentLength"])) },
    { label: "Response time", value: formatValue(getFirstValue(rawHttpx, ["time", "response_time", "responseTimeMs"])) },
    { label: "Host IP", value: formatValue(getFirstValue(rawHttpx, ["host", "ip", "a"])) },
    { label: "CDN", value: formatValue(getFirstValue(rawHttpx, ["cdn", "cdn_name", "cdnName"])) },
  ]
}

function getNucleiRunRows(nuclei: NucleiSchema): EvidenceRow[] {
  const run = nuclei.run

  if (!run) {
    return [
      { label: "State", value: nuclei.state },
      { label: "Run", value: "No Nuclei run metadata", muted: true },
      { label: "Findings", value: nuclei.findings.length.toLocaleString() },
      { label: "Technologies", value: nuclei.technologies.length.toLocaleString() },
    ]
  }

  return [
    { label: "State", value: nuclei.state },
    { label: "Status", value: run.status },
    { label: "Target URL", value: formatValue(run.targetUrl) },
    { label: "Target host", value: formatValue(run.targetHost) },
    { label: "Engine", value: formatValue(run.engineVersion) },
    { label: "Templates", value: formatValue(run.templatesVersion) },
    { label: "Template IDs", value: run.templateIds.length.toLocaleString() },
    { label: "Headers", value: run.headers.length.toLocaleString() },
    { label: "Findings", value: nuclei.findings.length.toLocaleString() },
    { label: "Technologies", value: nuclei.technologies.length.toLocaleString() },
    { label: "Error", value: formatValue(run.errorMessage), muted: !run.errorMessage },
  ]
}

function EvidenceRows({ rows }: { rows: EvidenceRow[] }) {
  return (
    <Table>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="w-32 align-top text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {row.label}
            </TableCell>
            <TableCell
              className={cn(
                "whitespace-normal break-words font-mono text-xs leading-relaxed text-foreground",
                row.muted && "text-muted-foreground",
              )}
            >
              {row.value}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function EvidenceSummaryCard({
  title,
  description,
  icon: Icon,
  rows,
  badge,
}: {
  title: string
  description: string
  icon: ElementType
  rows: EvidenceRow[]
  badge: string
}) {
  return (
    <Card className="rounded-lg bg-card/70">
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">{badge}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <EvidenceRows rows={rows} />
      </CardContent>
    </Card>
  )
}

export function RawEvidenceSummaryCards({ rawHttpx, nuclei }: RawEvidenceTabsProps) {
  const httpxStats = useMemo(() => getJsonStats(rawHttpx), [rawHttpx])
  const nucleiStats = useMemo(() => getJsonStats(nuclei), [nuclei])

  return (
    <>
      <EvidenceSummaryCard
        title="HTTPX probe"
        description="Normalized response fields from the raw HTTP probe payload."
        icon={Terminal}
        rows={getHttpxRows(rawHttpx)}
        badge={formatBytes(httpxStats.bytes)}
      />
      <EvidenceSummaryCard
        title="Nuclei run"
        description="Run metadata, template coverage, and scanner state."
        icon={Shield}
        rows={getNucleiRunRows(nuclei)}
        badge={formatBytes(nucleiStats.bytes)}
      />
    </>
  )
}

function JsonPayloadPanel({
  title,
  description,
  icon: Icon,
  data,
}: {
  title: string
  description: string
  icon: ElementType
  data: unknown
}) {
  const [copied, setCopied] = useState(false)
  const stats = useMemo(() => getJsonStats(data), [data])
  const keyedLines = useMemo(() => formatJsonLines(data), [data])

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }

    await navigator.clipboard.writeText(stats.json)
    setCopied(true)
    globalThis.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex flex-col">
      <div className="relative flex flex-wrap items-start justify-between gap-3 px-4 py-4 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-border/70">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{keyedLines.length.toLocaleString()} lines</Badge>
              <Badge variant="outline">{formatBytes(stats.bytes)}</Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={handleCopy}>
          {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>
      <ScrollArea className="h-[34rem] bg-background/25">
        <pre className="min-w-max p-4 font-mono text-xs leading-relaxed">
          {keyedLines.map(({ line, key }, index) => (
            <div key={key} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
              <span className="select-none text-right text-muted-foreground/60">{index + 1}</span>
              <code className={cn("whitespace-pre", getLineColor(line))}>{line || " "}</code>
            </div>
          ))}
        </pre>
      </ScrollArea>
    </div>
  )
}

export function RawEvidenceTabs({ rawHttpx, nuclei }: RawEvidenceTabsProps) {
  const [activeEvidenceTab, setActiveEvidenceTab] = useState("httpx")

  return (
    <section className="flex flex-col gap-4">
      <Card className="rounded-lg border-border/70 bg-card/80">
        <CardHeader className="border-b">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
              <FileJson className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Debug / Raw Evidence</CardTitle>
              <CardDescription className="mt-1 max-w-3xl">
                Full scanner JSON payloads persisted for this scan result.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeEvidenceTab} onValueChange={setActiveEvidenceTab} className="gap-0">
            <div className="border-b px-4 py-3">
              <TabsList className="grid w-full grid-cols-2 md:w-fit">
                <TabsTrigger value="httpx" onClick={() => setActiveEvidenceTab("httpx")}>
                  <Terminal data-icon="inline-start" />
                  HTTPX Probe
                </TabsTrigger>
                <TabsTrigger value="nuclei" onClick={() => setActiveEvidenceTab("nuclei")}>
                  <Shield data-icon="inline-start" />
                  Nuclei Security
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="httpx" className="m-0">
              <JsonPayloadPanel
                data={rawHttpx}
                title="HTTPX Probe Payload"
                description="Full raw payload persisted from the HTTP probe worker."
                icon={Terminal}
              />
            </TabsContent>

            <TabsContent value="nuclei" className="m-0">
              <JsonPayloadPanel
                data={nuclei}
                title="Nuclei Security Payload"
                description="Complete Nuclei JSON, including run metadata, technology matches, findings, and raw match bodies."
                icon={Shield}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </section>
  )
}
