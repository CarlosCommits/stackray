import { type NextRequest, NextResponse } from "next/server";

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "@/lib/session/actor-auth";
import { errorResponse } from "@/lib/server/http/error-response";
import { getTargetTechnologies } from "@/lib/server/scans/read-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalTargetId: string }> },
) {
  try {
    const actor = await requireSessionOrBearerActor(request);
    const { canonicalTargetId } = await params;
    const response = await getTargetTechnologies(
      actor,
      canonicalTargetId,
      request.nextUrl.searchParams.get("scanId")?.trim() || undefined,
    );

    return NextResponse.json(response);
  } catch (error) {
    return actorAuthErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
