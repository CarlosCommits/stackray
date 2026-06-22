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
    const rawLimit = searchParams.get("limit")?.trim().toLowerCase();
    const parsedLimit = rawLimit === "all" ? "all" : Number.parseInt(rawLimit ?? "10", 10);
    const excludeScanId = searchParams.get("excludeScanId")?.trim() || undefined;

    const response = await getTargetHistoryByCanonicalId(
      actor,
      canonicalTargetId,
      parsedLimit === "all" || (Number.isInteger(parsedLimit) && parsedLimit > 0) ? parsedLimit : 10,
      excludeScanId,
    );

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
