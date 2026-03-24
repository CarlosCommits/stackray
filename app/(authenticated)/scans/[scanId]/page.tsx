import { notFound } from "next/navigation"

import {
  ScanHero,
  ExecutiveSummary,
  TechStackModule,
  InfrastructureModule,
  EvidencePanel,
  ContentSignals,
  TargetHistory,
  RawPayloadViewer,
} from "@/components/scans"
import { mockScanResults, mockTargetHistory } from "@/lib/mocks/scans"

type ScanDetailPageProps = {
  params: Promise<{ scanId: string }>
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { scanId } = await params

  if (!scanId) {
    notFound()
  }

  const result = mockScanResults.items[0]

  if (!result) {
    notFound()
  }

  const redirectCount = result.redirectChain?.statusCodes?.length
    ? result.redirectChain.statusCodes.length - 1
    : 0

  const completedAt = new Date()
  completedAt.setSeconds(completedAt.getSeconds() - 8)

  return (
    <div className="space-y-6 w-full">
      <ScanHero
        scanId={scanId}
        target={result.target}
        profile="stack-deep"
        source="ui"
        status="completed"
        submittedAt={new Date(Date.now() - 120000).toISOString()}
        completedAt={completedAt.toISOString()}
      />

      <ExecutiveSummary
        technologies={result.technologies}
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
          <TechStackModule
            technologies={result.technologies}
            wordpress={result.wordpress}
          />

          <InfrastructureModule
            dns={{
              hostIp: result.dns?.hostIp ?? "N/A",
              a: result.dns?.a ?? [],
              aaaa: result.dns?.aaaa ?? [],
              cname: result.dns?.cname ?? [],
            }}
            asn={{
              asNumber: result.asn?.asNumber ?? "N/A",
              org: result.asn?.org ?? "Unknown",
            }}
            capabilities={result.capabilities}
          />
        </div>

        <div className="space-y-6">
          <EvidencePanel
            tls={{
              sni: result.tls?.sni ?? "N/A",
              jarmHash: result.tls?.jarmHash ?? "N/A",
            }}
            favicon={{
              mmh3: result.favicon?.mmh3 ?? "N/A",
              md5: result.favicon?.md5 ?? "N/A",
              url: result.favicon?.url ?? "",
            }}
          />

          <ContentSignals
            contentLength={result.contentLength}
            bodyDomains={result.bodyDomains}
            bodyFqdns={result.bodyFqdns}
            hashes={{
              md5: result.hashes?.md5 ?? "N/A",
              sha256: result.hashes?.sha256 ?? "N/A",
            }}
          />
        </div>
      </div>

      <div className="pt-4">
        <TargetHistory
          target={result.target}
          history={mockTargetHistory.items}
        />
      </div>

      <div className="pt-2">
        <RawPayloadViewer
          rawHttpx={result.rawHttpx}
          scanId={scanId}
          target={result.target}
        />
      </div>
    </div>
  )
}
