import { NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { getScanComparisonForView } from "@/lib/server/changes/service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET(request: Request, context: { params: Promise<{ scanId: string }> }) {
  try {
    const [actor, { scanId }] = await Promise.all([
      requireSessionOrBearerActor(request),
      context.params,
    ]);
    const baselineScanId = new URL(request.url).searchParams.get("baselineScanId");

    return NextResponse.json(await getScanComparisonForView(actor, scanId, baselineScanId));
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(400, "comparison_read_failed", error instanceof Error ? error.message : "Unable to load the comparison.");
  }
}
