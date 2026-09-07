import Link from "next/link"
import { History } from "lucide-react"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"

import { ChangeComparisonTimeline } from "@/components/changes/change-comparison-timeline"
import { ChangeDetailModal } from "@/components/changes/change-detail-modal"
import { ChangeFilters } from "@/components/changes/change-filters"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { parseChangeFeedPageQuery } from "@/lib/queries/changes"
import { requireAppSession } from "@/lib/session/app-session"
import { getComparisonForView } from "@/lib/server/changes/service"
import { getTargetChangeHistory } from "@/lib/server/targets/profile-service"
import { BROWSER_TIME_ZONE_COOKIE_NAME, isValidTimeZone } from "@/lib/time"

type SearchParams = Record<string, string | string[] | undefined>

function firstParam(params: SearchParams, key: string) {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

function buildChangesHref(
  basePath: string,
  filters: { category: string | null },
  selection?: { comparison: string; item?: string },
) {
  const params = new URLSearchParams()
  if (filters.category) params.set("category", filters.category)
  if (selection) {
    params.set("comparison", selection.comparison)
    if (selection.item) params.set("item", selection.item)
  }
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export default async function TargetChangesPage({
  params,
  searchParams,
}: {
  params: Promise<{ targetId: string }>
  searchParams: Promise<SearchParams>
}) {
  const [session, { targetId }, resolvedSearchParams] = await Promise.all([
    requireAppSession(),
    params,
    searchParams,
  ])
  const parsedQuery = parseChangeFeedPageQuery(resolvedSearchParams)
  const query = { ...parsedQuery, target: null }
  const selectedComparisonId = firstParam(resolvedSearchParams, "comparison")
  const selectedItemId = firstParam(resolvedSearchParams, "item")
  const cookieTimeZone = (await cookies()).get(BROWSER_TIME_ZONE_COOKIE_NAME)?.value ?? null
  const timeZone = cookieTimeZone && isValidTimeZone(cookieTimeZone) ? cookieTimeZone : null
  const [response, selectedComparison] = await Promise.all([
    getTargetChangeHistory(session, targetId, query, { timeZone }),
    selectedComparisonId ? getComparisonForView(session, selectedComparisonId) : Promise.resolve(null),
  ])

  if (selectedComparison && selectedComparison.canonicalTargetId !== targetId) {
    notFound()
  }

  const basePath = `/targets/${targetId}/changes`
  const filterState = { category: query.category }
  const closeHref = buildChangesHref(basePath, filterState)
  const historyItems = selectedComparison && !response.items.some((comparison) => comparison.id === selectedComparison.id)
    ? [...response.items, selectedComparison].toSorted((left, right) => (
        Date.parse(right.currentScan.completedAt ?? "") - Date.parse(left.currentScan.completedAt ?? "")
      ))
    : response.items

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex justify-end">
        <ChangeFilters
          key={query.category ?? ""}
          initialFilters={{ target: null, category: query.category }}
          basePath={basePath}
          showTargetSearch={false}
          surface={false}
        />
      </div>

      {historyItems.length > 0 ? (
        <ChangeComparisonTimeline
          variant="target"
          comparisons={historyItems}
          basePath={basePath}
          category={filterState.category}
          selectedComparisonId={selectedComparisonId ?? null}
          selectedItemId={selectedItemId ?? null}
        />
      ) : (
        <Empty className="min-h-52 border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon"><History aria-hidden="true" /></EmptyMedia>
            <EmptyTitle>No matching change history</EmptyTitle>
            <EmptyDescription>Run another scan or clear the current category filter.</EmptyDescription>
          </EmptyHeader>
          {query.category ? <EmptyContent><Button asChild variant="outline" size="sm"><Link href={basePath}>Clear filter</Link></Button></EmptyContent> : null}
        </Empty>
      )}

      {response.nextCursor ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <Link href={`${buildChangesHref(basePath, filterState)}${buildChangesHref(basePath, filterState).includes("?") ? "&" : "?"}cursor=${encodeURIComponent(response.nextCursor)}`}>
              Load older comparisons
            </Link>
          </Button>
        </div>
      ) : null}

      {selectedComparison && selectedItemId ? (
        <ChangeDetailModal comparison={selectedComparison} initialItemId={selectedItemId} closeHref={closeHref} />
      ) : null}
    </div>
  )
}
