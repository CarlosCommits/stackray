import { RunsClient } from "@/components/runs/runs-client"
import { listRuns } from "@/lib/queries/runs"
import { requireAppSession } from "@/lib/session/app-session"

export default async function TargetScansPage({ params }: { params: Promise<{ targetId: string }> }) {
  const [session, { targetId }] = await Promise.all([requireAppSession(), params])
  const data = await listRuns(
    session,
    new URLSearchParams({ limit: "50" }),
    { canonicalTargetId: targetId },
  )

  return (
    <div className="p-4 sm:p-5">
      <RunsClient
        initialRows={data.items}
        initialNextCursor={data.nextCursor}
        canonicalTargetId={targetId}
        showTargetColumn={false}
        searchPlaceholder="Search scan IDs or URLs..."
        stickyFilters={false}
      />
    </div>
  )
}
