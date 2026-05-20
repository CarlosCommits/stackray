import { type NextRequest, NextResponse } from "next/server";

import {
  clampDashboardRecentScanPageLimit,
} from "@/lib/dashboard/recent-scan-pagination";
import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getDashboardRecentScansPage } from "@/lib/server/scans/read-service";

function parseLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return clampDashboardRecentScanPageLimit(parsed);
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const response = await getDashboardRecentScansPage(actor, {
      cursor: request.nextUrl.searchParams.get("cursor"),
      limit: parseLimit(request.nextUrl.searchParams.get("limit")),
    });

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
