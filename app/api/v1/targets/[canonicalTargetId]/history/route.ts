import { type NextRequest, NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getTargetHistoryByCanonicalId } from "@/lib/server/scans/read-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalTargetId: string }> }
) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const { canonicalTargetId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    const excludeScanId = searchParams.get("excludeScanId")?.trim() || undefined;

    const response = await getTargetHistoryByCanonicalId(
      actor,
      canonicalTargetId,
      Number.isInteger(limit) && limit > 0 ? limit : 10,
      excludeScanId,
    );

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
