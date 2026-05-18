import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"

import { ScanDetailLiveClient } from "@/components/scans/scan-detail-live-client"
import {
  ScanDetailHeader,
  OverviewMetrics,
  PageTitleCard,
  TechnologiesSection,
  TechnicalDetailsSection,
  DnsInfrastructureCard,
  SubdomainsSectionCard,
  TlsCertificateSection,
  FingerprintsSection,
  DomainInfoSection,
  ContentSignalsSectionCard,
  RobotsTxtSection,
  ScreenshotPreviewCard,
  RedirectChainCard,
  BodyDomainsCard,
  HistoryCard,
  ScanInfoCard,
  QuickActionsCard,
  RawEvidenceCard,
} from "@/components/scans/scan-detail-sections"
import { requireAppSession } from "@/lib/session/app-session"
import {
  getTargetHistoryForScan,
  getAuthoritativeScanResult,
  getScanDetail,
  getScanRecord,
  getScanSubdomains,
} from "@/lib/server/scans/read-service"
import { buildTechnologyDisplayModel } from "@/lib/server/scans/technology-display"
import { buildScanDetailPageViewModel } from "@/lib/server/scans/scan-detail-view-model"

type ScanDetailPageProps = {
  params: Promise<{ scanId: string }>
}

export const metadata: Metadata = {
  title: "Scan detail | Stackray",
  description: "Review Stackray scan results, technologies, fingerprints, screenshots, and raw evidence.",
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const session = await requireAppSession()
  const { scanId } = await params

  if (!scanId) {
    notFound()
  }

  const [scanRecord, scanDetail, primaryResult, targetHistory, subdomains] = await Promise.all([
    getScanRecord(session, scanId),
    getScanDetail(session, scanId),
    getAuthoritativeScanResult(session, scanId),
    getTargetHistoryForScan(session, scanId),
    getScanSubdomains(session, scanId, { pageSize: 250 }),
  ])

  if (!scanRecord || !scanDetail) {
    notFound()
  }

  // Build technology display model if we have a result
  const technologyDisplay = primaryResult
    ? buildTechnologyDisplayModel({
        detections: primaryResult.technologyDetections,
        wordpress: primaryResult.wordpress,
        cpe: primaryResult.cpe,
      })
    : null

  // Build the page view-model
  const viewModel = buildScanDetailPageViewModel({
    scanId,
    scanDetail,
    scanRecord,
    primaryResult,
    targetHistory: targetHistory
      ? {
          target: targetHistory.normalizedTarget,
          items: targetHistory.items.flatMap((item) => {
            if (item.status !== "completed" && item.status !== "failed" && item.status !== "cancelled") {
              return []
            }

            return [{
              scanId: item.scanId,
              status: item.status,
              title: item.title,
              technologies: item.technologies,
              completedAt: item.completedAt ?? item.submittedAt,
            }]
          }),
        }
      : null,
    technologyDisplay: technologyDisplay
      ? {
          buckets: technologyDisplay.buckets,
        }
      : null,
    subdomains: subdomains
      ? {
          summary: subdomains.summary,
          items: subdomains.items,
          total: subdomains.total,
        }
      : null,
  })

  return (
    <div className="min-h-screen bg-[var(--background)] p-4 md:p-6">
      <ScanDetailLiveClient scanId={scanId} active={viewModel.isActive} />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <ScanDetailHeader
            scanId={viewModel.scanId}
            target={viewModel.target}
            status={viewModel.heroStatus}
            source={viewModel.source}
            submittedAt={viewModel.submittedAt}
            currentAttempt={viewModel.currentAttempt}
            attemptHistory={viewModel.attemptHistory}
          />

          {viewModel.overview ? (
            <>
              {/* Key Metrics */}
              <OverviewMetrics overview={viewModel.overview} />

              {/* Page Title & Final URL */}
              <PageTitleCard
                title={viewModel.overview.title}
                finalUrl={viewModel.overview.finalUrl}
                favicon={viewModel.tlsFingerprints?.favicon}
              />

              {/* Technologies */}
              {viewModel.technology && <TechnologiesSection technology={viewModel.technology} />}

              {/* Technical Details */}
              {viewModel.deliveryRedirects && (
                <TechnicalDetailsSection delivery={viewModel.deliveryRedirects} />
              )}

              {/* DNS & Infrastructure */}
              {viewModel.dnsInfrastructure && (
                <DnsInfrastructureCard dns={viewModel.dnsInfrastructure} />
              )}

              {viewModel.subdomains && (
                <SubdomainsSectionCard scanId={scanId} subdomains={viewModel.subdomains} />
              )}

              {/* TLS Certificate */}
              {viewModel.tlsFingerprints && (
                <TlsCertificateSection tls={viewModel.tlsFingerprints} />
              )}

              {/* Fingerprints */}
              {viewModel.tlsFingerprints && (
                <FingerprintsSection tls={viewModel.tlsFingerprints} />
              )}

              {/* Domain Info */}
              {viewModel.domainIntelligence && (
                <DomainInfoSection domain={viewModel.domainIntelligence} />
              )}

              {viewModel.contentSignals && (
                <ContentSignalsSectionCard content={viewModel.contentSignals} />
              )}

              {/* Robots.txt */}
              {viewModel.contentSignals && (
                <RobotsTxtSection content={viewModel.contentSignals} />
              )}

              {/* Raw Evidence */}
              {viewModel.rawEvidence && (
                <RawEvidenceCard
                  rawEvidence={viewModel.rawEvidence}
                  scanId={scanId}
                  target={viewModel.target}
                />
              )}
            </>
          ) : (
            <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]/20">
              <CardContent className="py-8 text-sm text-[var(--muted-foreground)]">
                This scan is queued or still warming up. The page will refresh automatically when the first persisted result arrives.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-4 lg:pl-4 mt-4 lg:mt-0">
          {/* Quick Actions */}
          <QuickActionsCard
            target={viewModel.target}
            scheduleSeed={{
              targets: [scanDetail.target.normalizedTarget],
              options: {
                followRedirects: scanRecord.optionsJson.followRedirects === true,
              },
            }}
          />

          {/* Screenshot */}
          {viewModel.contentSignals && (
            <ScreenshotPreviewCard
              content={viewModel.contentSignals}
              target={viewModel.target}
            />
          )}

          {/* Redirect Chain */}
          {viewModel.deliveryRedirects && (
            <RedirectChainCard delivery={viewModel.deliveryRedirects} />
          )}

          {/* Body Domains */}
          {viewModel.contentSignals && (
            <BodyDomainsCard content={viewModel.contentSignals} />
          )}

          {/* History */}
          {viewModel.history && viewModel.history.items.length > 0 && (
            <HistoryCard history={viewModel.history} />
          )}

          {/* Scan Info */}
          <ScanInfoCard
            source={viewModel.source}
            submittedAt={viewModel.submittedAt}
            completedAt={viewModel.completedAt}
            asnNumber={viewModel.dnsInfrastructure?.asn.asNumber ?? null}
          />
        </div>
      </div>
    </div>
  )
}
