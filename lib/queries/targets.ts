import { requireAppSession } from "@/lib/session/app-session";
import { getTargetResults as getTargetResultsData } from "@/lib/server/targets/service";
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
}

export async function getTargetsPageData(searchParams?: TargetParamsInput): Promise<TargetsPageData> {
  const session = await requireAppSession();
  const query = parseTargetQuery(searchParams);
  const response = await getTargetResultsData(session, searchParams);

  return {
    query,
    rows: buildTargetRows(response.items),
    nextCursor: response.nextCursor,
  };
}
