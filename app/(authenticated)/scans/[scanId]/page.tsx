import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"

import {
  ScanHero,
  ScanOverviewStrip,
  ScanFindingsWorkspace,
  TechnicalEvidenceSection,
  VisualContentContext,
  TargetHistory,
  RawEvidenceTabs,
  ScanDetailLiveClient,
} from "@/components/scans"
import { requireAppSession } from "@/lib/session/app-session"
import {
  getTargetHistoryForScan,
  getScanDetail,
  getScanRecord,
  getScanResults,
} from "@/lib/server/scans/read-service"
import { buildTechnologyDisplayModel } from "@/lib/server/scans/technology-display"
import { selectPrimaryScanResult } from "@/lib/server/scans/result-selection"

type ScanDetailPageProps = {
  params: Promise<{ scanId: string }>
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const session = await requireAppSession()
  const { scanId } = await params

  if (!scanId) {
    notFound()
  }

  const [scanRecord, scanDetail, scanResults, targetHistory] = await Promise.all([
    getScanRecord(session, scanId),
    getScanDetail(session, scanId),
    getScanResults(session, scanId, { page: 1, pageSize: 20 }),
    getTargetHistoryForScan(session, scanId),
  ])

  if (!scanRecord || !scanDetail || !scanResults) {
    notFound()
  }

  const primaryTarget = scanDetail.targets[0]?.normalizedTarget ?? null
  const result = selectPrimaryScanResult(scanResults.items, primaryTarget)
  const target = primaryTarget ?? result?.target ?? "Pending target"
  const isActive = scanDetail.status === "queued" || scanDetail.status === "running" || scanDetail.status === "processing"
  const heroStatus =
    scanDetail.status === "completed" ||
    scanDetail.status === "failed" ||
    scanDetail.status === "cancelled"
      ? scanDetail.status
      : "running"

  const redirectCount = result?.redirectChain?.statusCodes?.length
    ? result.redirectChain.statusCodes.length - 1
    : 0
  const technologyDisplay = result
    ? buildTechnologyDisplayModel({
        technologies: result.technologies,
        wordpress: result.wordpress,
        cpe: result.cpe,
      })
    : null

  return (
    <div className="scan-page">
      <ScanDetailLiveClient scanId={scanId} active={isActive} />

      <ScanHero
        scanId={scanId}
        target={target}
        profile={scanDetail.profile}
        source={scanDetail.source}
        status={heroStatus}
        submittedAt={scanRecord.submittedAt.toISOString()}
        completedAt={scanRecord.completedAt?.toISOString() ?? null}
        currentAttempt={scanDetail.currentAttempt}
        attemptHistory={scanDetail.attemptHistory}
      />

      {result ? (
        <>
          {/* Section 2: Overview Strip */}
          <ScanOverviewStrip
            technologyItems={technologyDisplay?.orderedTechnologyItems ?? undefined}
            technologies={technologyDisplay?.orderedTechnologies ?? result.technologies}
            finalUrl={result.finalUrl}
            redirectCount={redirectCount}
            statusCode={result.statusCode}
            statusText="OK"
            server={result.server ?? undefined}
            cdnName={result.cdn?.name ?? "none"}
            hostIp={result.dns?.hostIp ?? "N/A"}
            title={result.title}
            asnOrg={result.asn?.org}
          />

          {/* Section 3: Findings Workspace */}
          <ScanFindingsWorkspace
            nuclei={result.nuclei}
            technologies={technologyDisplay?.orderedTechnologies ?? result.technologies}
            technologyItems={technologyDisplay?.orderedTechnologyItems}
            wordpress={technologyDisplay?.wordpress ?? result.wordpress}
            cpe={result.cpe}
          />

          {/* Section 4: Technical Evidence */}
          <TechnicalEvidenceSection
            finalUrl={result.finalUrl}
            path={result.path}
            method={result.method}
            location={result.location}
            contentType={result.contentType}
            responseTimeMs={result.responseTimeMs}
            redirectChain={result.redirectChain}
            dns={{
              hostIp: result.dns?.hostIp ?? "N/A",
              a: result.dns?.a ?? [],
              aaaa: result.dns?.aaaa ?? [],
              cname: result.dns?.cname ?? [],
              resolvers: result.dns?.resolvers ?? [],
            }}
            asn={{
              asNumber: result.asn?.asNumber ?? "N/A",
              org: result.asn?.org ?? "Unknown",
              country: result.asn?.country ?? null,
              range: result.asn?.range ?? [],
            }}
            capabilities={result.capabilities}
            tls={{
              sni: result.tls?.sni ?? "N/A",
              jarmHash: result.tls?.jarmHash ?? "N/A",
              certificate: result.tls?.certificate,
            }}
            favicon={{
              mmh3: result.favicon?.mmh3 ?? "N/A",
              md5: result.favicon?.md5 ?? "N/A",
              url: result.favicon?.url ?? "",
              path: result.favicon?.path ?? "",
            }}
          />

          {/* Section 5: Visual / Content Context */}
          <VisualContentContext
            target={target}
            screenshot={result.screenshot}
            contentLength={result.contentLength}
            bodyPreview={result.bodyPreview}
            bodyDomains={result.bodyDomains}
            bodyFqdns={result.bodyFqdns}
            hashes={result.hashes}
            title={result.title}
          />

          {/* Section 6: Target History */}
          <TargetHistory
            target={target}
            history={targetHistory?.items ?? []}
          />

          {/* Section 7: Debug / Raw Evidence */}
          <RawEvidenceTabs
            rawHttpx={result.rawHttpx}
            nuclei={result.nuclei}
            scanId={scanId}
            target={target}
          />
        </>
      ) : (
        <Card className="scan-panel">
          <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
            This scan is queued or still warming up. The page will refresh automatically when the first persisted result arrives.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
