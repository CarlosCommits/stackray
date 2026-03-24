import { getSearchPageData } from "@/lib/queries/search"
import { SearchClient } from "@/components/search"

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const data = await getSearchPageData(params)

  return (
    <SearchClient
      initialRows={data.rows}
      initialQuery={data.query}
      title="Cross-Scan Search"
    />
  )
}
