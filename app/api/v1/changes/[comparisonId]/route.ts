import { NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { getComparisonForView } from "@/lib/server/changes/service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET(request: Request, context: { params: Promise<{ comparisonId: string }> }) {
  try {
    const [actor, { comparisonId }] = await Promise.all([
      requireSessionOrBearerActor(request),
      context.params,
    ]);
    const comparison = await getComparisonForView(actor, comparisonId);

    if (!comparison) {
      return errorResponse(404, "comparison_not_found", "The requested comparison could not be found.");
    }

    return NextResponse.json(comparison);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(400, "comparison_read_failed", error instanceof Error ? error.message : "Unable to load the comparison.");
  }
}
