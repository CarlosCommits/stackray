import { getRunsPageData } from "@/lib/queries/runs"
import { RunsClient } from "@/components/runs/runs-client"

export default async function RunsPage() {
  const data = await getRunsPageData()

  return <RunsClient initialRows={data.rows} title="Scan Runs" />
}
