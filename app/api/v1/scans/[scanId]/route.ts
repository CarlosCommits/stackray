import { NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getScanDetail } from "@/lib/server/scans/read-service";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  try {
    const actor = await requireSessionOrBearerActor(_);
    const { scanId } = await context.params;
    const response = await getScanDetail(actor, scanId);

    if (!response) {
      return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
    }

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
