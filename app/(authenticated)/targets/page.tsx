import { getTargetsPageData } from "@/lib/queries/targets"
import { TargetsClient } from "@/components/targets"

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
    />
  )
}
