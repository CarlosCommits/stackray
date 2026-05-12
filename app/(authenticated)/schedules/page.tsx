import type { Metadata } from "next"

import { getSchedulesPageData } from "@/lib/queries/schedules"
import { SchedulesClient } from "@/components/schedules/schedules-client"

export const metadata: Metadata = {
  title: "Schedules | Stackray",
  description: "Manage recurring Stackray scans and scheduled target monitoring.",
}

export default async function SchedulesPage() {
  const data = await getSchedulesPageData()

  return <SchedulesClient initialSchedules={data.items} />
}
