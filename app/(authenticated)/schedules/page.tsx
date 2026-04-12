import { getSchedulesPageData } from "@/lib/queries/schedules"
import { SchedulesClient } from "@/components/schedules/schedules-client"

export default async function SchedulesPage() {
  const data = await getSchedulesPageData()

  return <SchedulesClient initialSchedules={data.items} />
}