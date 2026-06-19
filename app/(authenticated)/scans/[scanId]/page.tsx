import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ScanDetailLiveClient } from "@/components/scans/scan-detail-live-client"
import {
  ScanDetailHeader,
  ScanDetailSectionTabs,
  TechnologiesSection,
  DnsInfrastructureCard,
  SubdomainsSectionCard,
  TlsCertificateSection,
  FingerprintsSection,
  DomainInfoSection,
  RobotsTxtSection,
  ScanOverviewBand,
  RedirectChainCard,
  BodyDomainsCard,
  HistoryCard,
  NetworkIntelligenceCard,
  ScanInfoCard,
  RawEvidenceCard,
  RawEvidenceSummaryCards,
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

  const sectionTabItems = [
    viewModel.technology
      ? {
          value: "technologies",
          label: "Technologies",
          content: <TechnologiesSection technology={viewModel.technology} />,
        }
      : null,
    viewModel.dnsInfrastructure
      ? {
          value: "dnsInfrastructure",
          label: "DNS & Network",
          content: <DnsInfrastructureCard dns={viewModel.dnsInfrastructure} />,
        }
      : null,
    viewModel.networkIntelligence
      ? {
          value: "ipIntelligence",
          label: "IP Intelligence",
          content: <NetworkIntelligenceCard network={viewModel.networkIntelligence} />,
        }
      : null,
    viewModel.subdomains
      ? {
          value: "subdomains",
          label: "Subdomains",
          content: <SubdomainsSectionCard scanId={scanId} subdomains={viewModel.subdomains} />,
        }
      : null,
    viewModel.tlsFingerprints
      ? {
          value: "tlsCertificate",
          label: "TLS Certificate",
          content: <TlsCertificateSection tls={viewModel.tlsFingerprints} />,
        }
      : null,
    viewModel.tlsFingerprints
      ? {
          value: "fingerprints",
          label: "Fingerprints",
          content: <FingerprintsSection tls={viewModel.tlsFingerprints} />,
        }
      : null,
    viewModel.domainIntelligence
      ? {
          value: "domainInfo",
          label: "Domain Info",
          content: <DomainInfoSection domain={viewModel.domainIntelligence} />,
        }
      : null,
    {
      value: "scanInfo",
      label: "Scan Info",
      content: (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {viewModel.deliveryRedirects && (
            <RedirectChainCard delivery={viewModel.deliveryRedirects} />
          )}

          {viewModel.contentSignals && (
            <BodyDomainsCard content={viewModel.contentSignals} />
          )}

          {viewModel.contentSignals && (
            <RobotsTxtSection content={viewModel.contentSignals} />
          )}

          {viewModel.history && viewModel.history.items.length > 0 && (
            <HistoryCard history={viewModel.history} />
          )}

          <ScanInfoCard
            scanId={viewModel.scanId}
            source={viewModel.source}
            submittedAt={viewModel.submittedAt}
            completedAt={viewModel.completedAt}
            asnNumber={viewModel.dnsInfrastructure?.asn.asNumber ?? null}
          />

          {viewModel.rawEvidence ? (
            <RawEvidenceSummaryCards
              rawHttpx={viewModel.rawEvidence.rawHttpx}
              nuclei={viewModel.rawEvidence.nuclei}
            />
          ) : null}
        </div>
      ),
    },
    viewModel.rawEvidence
      ? {
          value: "rawEvidence",
          label: "Raw Evidence",
          content: <RawEvidenceCard rawEvidence={viewModel.rawEvidence} />,
        }
      : null,
  ].flatMap((item) => (item ? [item] : []))

  return (
    <div className="min-w-0">
      <ScanDetailLiveClient scanId={scanId} active={viewModel.isActive} />

      <section className="min-w-0 space-y-3">
        <ScanDetailHeader
          target={viewModel.target}
          status={viewModel.heroStatus}
          submittedAt={viewModel.submittedAt}
          currentAttempt={viewModel.currentAttempt}
          attemptHistory={viewModel.attemptHistory}
          favicon={viewModel.tlsFingerprints?.favicon}
          pageTitle={viewModel.overview?.title}
          finalUrl={viewModel.overview?.finalUrl}
        />

        <ScanOverviewBand
          content={viewModel.contentSignals}
          target={viewModel.target}
          overview={viewModel.overview}
          phases={scanDetail.phases}
        />
        {viewModel.overview ? (
          <ScanDetailSectionTabs items={sectionTabItems} />
        ) : (
          <div className="border border-[var(--gray-border)]/25 bg-[var(--surface-dark)]/70 px-4 py-6 text-sm text-[var(--muted-foreground)]">
            This scan is queued or still warming up. The page will refresh automatically when the first persisted result arrives.
          </div>
        )}
      </section>
    </div>
  )
}
