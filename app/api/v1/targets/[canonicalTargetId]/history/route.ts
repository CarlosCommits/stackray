import { type NextRequest, NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { getTargetHistoryByCanonicalId } from "@/lib/server/scans/read-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalTargetId: string }> }
) {
  const session = await requireAppSession();
  const { canonicalTargetId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
  const excludeScanId = searchParams.get("excludeScanId")?.trim() || undefined;

  const response = await getTargetHistoryByCanonicalId(
    session,
    canonicalTargetId,
    Number.isInteger(limit) && limit > 0 ? limit : 10,
    excludeScanId,
  );

  return NextResponse.json(response);
}
