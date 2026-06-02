import type { Metadata } from "next"

import { getTargetsPageData } from "@/lib/queries/targets"
import { TargetsClient } from "@/components/targets"

export const metadata: Metadata = {
  title: "Targets | Stackray",
  description: "Browse scanned targets, latest scan status, and discovered technologies.",
}

interface TargetsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TargetsPage({ searchParams }: TargetsPageProps) {
  const params = await searchParams
  const data = await getTargetsPageData(params)

  return (
    <TargetsClient
      initialRows={data.rows}
      initialNextCursor={data.nextCursor}
      initialQuery={data.query}
      initialFilterOptions={data.filterOptions}
    />
  )
}
