import { requireAppSession } from "@/lib/session/app-session";
import { getTargetResults } from "@/lib/server/targets/service";
import type { TargetFilterOptionsResponse } from "@/lib/contracts/targets";
import {
  buildTargetRows,
  parseTargetQuery,
  type TargetParamsInput,
  type TargetQuery,
  type TargetRow,
} from "@/lib/targets/shared";

interface TargetsPageData {
  query: TargetQuery;
  rows: TargetRow[];
  nextCursor: string | null;
  filterOptions: TargetFilterOptionsResponse;
  filterOptionsLoaded: boolean;
}

const EMPTY_TARGET_FILTER_OPTIONS: TargetFilterOptionsResponse = {
  technology: [],
  cdn: [],
  server: [],
  plugin: [],
  theme: [],
  cpe: [],
  statusCode: [],
};

export async function getTargetsPageData(searchParams?: TargetParamsInput): Promise<TargetsPageData> {
  const session = await requireAppSession();
  const query = parseTargetQuery(searchParams);
  const response = await getTargetResults(session, searchParams);

  return {
    query,
    rows: buildTargetRows(response.items),
    nextCursor: response.nextCursor,
    filterOptions: EMPTY_TARGET_FILTER_OPTIONS,
    filterOptionsLoaded: false,
  };
}
