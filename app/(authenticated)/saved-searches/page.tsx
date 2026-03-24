import { getSavedSearchesPageData } from "@/lib/queries/saved-searches"
import { SavedSearchesClient } from "@/components/saved-searches"

export default async function SavedSearchesPage() {
  const data = await getSavedSearchesPageData()

  return <SavedSearchesClient initialRows={data.rows} />
}
