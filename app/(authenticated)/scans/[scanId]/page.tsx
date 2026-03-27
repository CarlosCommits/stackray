import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"

import {
  ScanHero,
  ExecutiveSummary,
  DeliveryModule,
  TechStackModule,
  InfrastructureModule,
  EvidencePanel,
  ContentSignals,
  HomepageScreenshot,
  TargetHistory,
  RawPayloadViewer,
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
    <div className="space-y-6 w-full">
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
          <ExecutiveSummary
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
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <DeliveryModule
                finalUrl={result.finalUrl}
                path={result.path}
                method={result.method}
                location={result.location}
                contentType={result.contentType}
                responseTimeMs={result.responseTimeMs}
                redirectChain={result.redirectChain}
              />

              <TechStackModule
                primaryTechnologyItems={technologyDisplay?.primaryTechnologyItems ?? result.technologies.slice(0, 2).map((name) => ({ name, inferred: false }))}
                primaryTechnologies={technologyDisplay?.primaryTechnologies ?? []}
                additionalFindingItems={technologyDisplay?.additionalFindingItems ?? result.technologies.slice(2).map((name) => ({ name, inferred: false }))}
                additionalFindings={technologyDisplay?.additionalFindings ?? []}
                wordpress={technologyDisplay?.wordpress ?? result.wordpress}
                cpe={result.cpe}
              />

              <InfrastructureModule
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
              />
            </div>

            <div className="space-y-6">
              <HomepageScreenshot
                target={target}
                screenshot={result.screenshot}
              />

              <EvidencePanel
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

              <ContentSignals
                contentLength={result.contentLength}
                bodyPreview={result.bodyPreview}
                bodyDomains={result.bodyDomains}
                bodyFqdns={result.bodyFqdns}
                hashes={result.hashes}
              />
            </div>
          </div>

          <div className="pt-4">
            <TargetHistory
              target={target}
              history={targetHistory?.items ?? []}
            />
          </div>

          <div className="pt-2">
            <RawPayloadViewer
              rawHttpx={result.rawHttpx}
              scanId={scanId}
              target={target}
            />
          </div>
        </>
      ) : (
        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardContent className="py-8 text-sm text-[var(--text-dim)]">
            This scan is queued or still warming up. The page will refresh automatically when the first persisted result arrives.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
