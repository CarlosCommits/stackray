import { type NextRequest, NextResponse } from "next/server";

import { apiActorErrorResponse, requireApiActor } from "@/lib/session/api-actor";
import { errorResponse } from "@/lib/server/http/error-response";
import { listRuns } from "@/lib/queries/runs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireApiActor(request);
    const response = await listRuns(actor, request.nextUrl.searchParams);

    return NextResponse.json(response);
  } catch (error) {
    return apiActorErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
