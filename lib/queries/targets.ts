import { requireAppSession } from "@/lib/session/app-session";
import { getTargetsPageResult } from "@/lib/server/targets/service";
import type { TargetFilterOptionsResponse } from "@/lib/contracts/targets";
import {
  buildTargetRows,
  type TargetParamsInput,
  type TargetQuery,
  type TargetRow,
} from "@/lib/targets/shared";

interface TargetsPageData {
  query: TargetQuery;
  rows: TargetRow[];
  nextCursor: string | null;
  filterOptions: TargetFilterOptionsResponse;
}

export async function getTargetsPageData(searchParams?: TargetParamsInput): Promise<TargetsPageData> {
  const session = await requireAppSession();
  const response = await getTargetsPageResult(session, searchParams);

  return {
    query: response.query,
    rows: buildTargetRows(response.results.items),
    nextCursor: response.results.nextCursor,
    filterOptions: response.filterOptions,
  };
}
