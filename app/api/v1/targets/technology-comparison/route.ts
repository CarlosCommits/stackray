import { type NextRequest, NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getTechnologyComparisonResults } from "@/lib/server/targets/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const response = await getTechnologyComparisonResults(actor, request.nextUrl.searchParams);

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
