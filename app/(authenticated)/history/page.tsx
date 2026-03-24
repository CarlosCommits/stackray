import { getHistoryPageData } from "@/lib/queries/history"
import { HistoryClient } from "@/components/history/history-client"

export default async function HistoryPage() {
  const data = await getHistoryPageData()

  return <HistoryClient initialRows={data.rows} title="Scan History" />
}
