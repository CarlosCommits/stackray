import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateMonitoringBaselineRequestSchema } from "@/lib/contracts/changes";
import { requireAppSession } from "@/lib/session/app-session";
import { updateMonitoringBaseline } from "@/lib/server/changes/service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function PUT(request: Request, context: { params: Promise<{ canonicalTargetId: string }> }) {
  try {
    const [session, { canonicalTargetId }, payload] = await Promise.all([
      requireAppSession(),
      context.params,
      request.json(),
    ]);
    const input = updateMonitoringBaselineRequestSchema.parse(payload);

    return NextResponse.json(await updateMonitoringBaseline(session, canonicalTargetId, input));
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }

    return errorResponse(403, "baseline_update_failed", error instanceof Error ? error.message : "Unable to update the baseline.");
  }
}
