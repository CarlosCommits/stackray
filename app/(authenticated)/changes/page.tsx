import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ChangeFeed } from "@/components/changes/change-feed";
import { CHANGE_FEED_PAGE_SIZE } from "@/lib/changes/feed";
import { getChangeFeedPageData, parseChangeFeedPageQuery } from "@/lib/queries/changes";
import { requireAppSession } from "@/lib/session/app-session";
import { BROWSER_TIME_ZONE_COOKIE_NAME, isValidTimeZone } from "@/lib/time";

export const metadata: Metadata = {
  title: "Changes | Stackray",
  description: "Review changes detected between compatible Stackray scans.",
};

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [session, resolvedSearchParams] = await Promise.all([requireAppSession(), searchParams]);
  const query = parseChangeFeedPageQuery(resolvedSearchParams);
  const cookieTimeZone = (await cookies()).get(BROWSER_TIME_ZONE_COOKIE_NAME)?.value ?? null;
  const timeZone = cookieTimeZone && isValidTimeZone(cookieTimeZone) ? cookieTimeZone : null;
  const response = await getChangeFeedPageData(session, { ...query, limit: CHANGE_FEED_PAGE_SIZE }, { timeZone });

  return (
    <ChangeFeed
      key={`${query.target ?? ""}:${query.category ?? ""}:${query.cursor ?? ""}`}
      response={response}
      filters={{ target: query.target, category: query.category }}
    />
  );
}
