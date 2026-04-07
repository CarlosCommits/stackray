import { NextResponse } from "next/server";

import { apiActorErrorResponse, requireApiActor } from "@/lib/session/api-actor";
import { errorResponse } from "@/lib/server/http/error-response";
import { getScanDetail } from "@/lib/server/scans/read-service";

export async function GET(_: Request, context: { params: Promise<{ scanId: string }> }) {
  try {
    const actor = await requireApiActor(_);
    const { scanId } = await context.params;
    const response = await getScanDetail(actor, scanId);

    if (!response) {
      return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
    }

    return NextResponse.json(response);
  } catch (error) {
    return apiActorErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
