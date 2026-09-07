import { changeCategorySchema, changeFeedQuerySchema, type ChangeFeedQuery } from "@/lib/contracts/changes";
import type { AppSession } from "@/lib/session/app-session";
import { listChangeFeed } from "@/lib/server/changes/service";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(searchParams: SearchParams, name: string) {
  const value = searchParams[name];
  return Array.isArray(value) ? value[0] : value;
}

export function parseChangeFeedPageQuery(searchParams: SearchParams): ChangeFeedQuery {
  const rawLimit = Number.parseInt(firstParam(searchParams, "limit") ?? "30", 10);
  const category = changeCategorySchema.safeParse(firstParam(searchParams, "category"));
  const target = firstParam(searchParams, "target")?.trim() || null;

  return changeFeedQuerySchema.parse({
    cursor: firstParam(searchParams, "cursor") ?? null,
    limit: Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30,
    category: category.success ? category.data : null,
    target,
  });
}

export function getChangeFeedPageData(
  session: AppSession,
  query: ChangeFeedQuery,
  options: { timeZone?: string | null } = {},
) {
  return listChangeFeed(session, query, options);
}
