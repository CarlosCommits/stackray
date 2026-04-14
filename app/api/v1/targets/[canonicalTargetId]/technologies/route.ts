import { type NextRequest, NextResponse } from "next/server";

import { apiActorErrorResponse, requireApiActor } from "@/lib/session/api-actor";
import { errorResponse } from "@/lib/server/http/error-response";
import { getTargetTechnologies } from "@/lib/server/scans/read-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canonicalTargetId: string }> },
) {
  try {
    const actor = await requireApiActor(request);
    const { canonicalTargetId } = await params;
    const response = await getTargetTechnologies(
      actor,
      canonicalTargetId,
      request.nextUrl.searchParams.get("scanId")?.trim() || undefined,
    );

    return NextResponse.json(response);
  } catch (error) {
    return apiActorErrorResponse(error)
      ?? errorResponse(403, "forbidden", error instanceof Error ? error.message : "Forbidden");
  }
}
