import type { Metadata } from "next"

import { getRunsPageData } from "@/lib/queries/runs"
import { RunsClient } from "@/components/runs/runs-client"

export const metadata: Metadata = {
  title: "Runs | Stackray",
  description: "Review submitted Stackray scan runs and their statuses.",
}

export default async function RunsPage() {
  const data = await getRunsPageData()

  return <RunsClient initialRows={data.rows} initialNextCursor={data.nextCursor} />
}
