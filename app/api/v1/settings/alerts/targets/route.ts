import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAppSession } from "@/lib/session/app-session";
import { listAlertPolicyTargetOptions } from "@/lib/server/alerts/target-options-service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

const targetIdsSchema = z.array(z.string().uuid()).max(100);

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAppSession();
    const targetIds = targetIdsSchema.parse(request.nextUrl.searchParams.getAll("id"));
    return NextResponse.json(await listAlertPolicyTargetOptions(actor, targetIds));
  } catch (error) {
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    return errorResponse(403, "alert_target_options_access_denied", error instanceof Error ? error.message : "Forbidden");
  }
}
