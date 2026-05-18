import { type NextRequest, NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getScanSubdomains } from "@/lib/server/scans/read-service";

export async function GET(request: NextRequest, context: { params: Promise<{ scanId: string }> }) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const { scanId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "50", 10);
    const response = await getScanSubdomains(actor, scanId, {
      page: Number.isInteger(page) && page > 0 ? page : 1,
      pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 50,
      host: searchParams.get("host"),
      source: searchParams.get("source"),
    });

    if (!response) {
      return errorResponse(404, "scan_not_found", "The requested scan could not be found.");
    }

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
