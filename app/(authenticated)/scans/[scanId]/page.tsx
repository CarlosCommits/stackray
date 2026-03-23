import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { mockScanDetail, mockScanResults } from "@/lib/mocks/scans"

type ScanDetailPageProps = {
  params: Promise<{ scanId: string }>
}

export default async function ScanDetailPage({ params }: ScanDetailPageProps) {
  const { scanId } = await params

  if (!scanId) {
    notFound()
  }

  const result = mockScanResults.items[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Scan ID</p>
          <h1 className="font-[var(--font-heading)] text-2xl font-bold text-[var(--foreground)]">{scanId}</h1>
        </div>
        <Badge className="bg-[var(--accent)] text-[var(--primary-foreground)]">{mockScanDetail.status}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)]">Result Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Target</p>
                <p className="font-mono text-sm text-[var(--foreground)]">{result?.target}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Status</p>
                <p className="font-mono text-sm text-[var(--foreground)]">{result?.statusCode}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Server</p>
                <p className="font-mono text-sm text-[var(--foreground)]">{result?.server}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">CDN</p>
                <p className="font-mono text-sm text-[var(--foreground)]">{result?.cdn.name}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-[var(--text-dim)]">Technologies</p>
              <div className="flex flex-wrap gap-2">
                {result?.technologies.map((technology) => (
                  <Badge key={technology} variant="outline" className="border-[var(--gray-border)] text-[var(--foreground)]">
                    {technology}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[var(--surface-dark)] border-[var(--gray-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--foreground)]">Attempt Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[var(--text-dim)]">
            <p>Attempt #{mockScanDetail.currentAttempt.attemptNumber}</p>
            <p>Processed targets: {mockScanDetail.progress.processedTargets}</p>
            <p>Total targets: {mockScanDetail.progress.totalTargets}</p>
            <p>Result count: {mockScanDetail.progress.resultCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
