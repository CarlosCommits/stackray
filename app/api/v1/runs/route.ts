import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { listRuns } from "@/lib/queries/runs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const requestedTargetId = request.nextUrl.searchParams.get("targetId");
    const parsedTargetId = requestedTargetId
      ? z.string().uuid().safeParse(requestedTargetId)
      : null;

    if (parsedTargetId && !parsedTargetId.success) {
      return errorResponse(400, "invalid_target_id", "Target ID must be a UUID");
    }

    const response = await listRuns(
      actor,
      request.nextUrl.searchParams,
      parsedTargetId?.success ? { canonicalTargetId: parsedTargetId.data } : {},
    );

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
