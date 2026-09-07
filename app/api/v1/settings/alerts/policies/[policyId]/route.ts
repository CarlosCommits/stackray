import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateAlertPolicyRequestSchema } from "@/lib/contracts/alerts";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { requireAppSession } from "@/lib/session/app-session";
import { deleteAlertPolicy, updateAlertPolicy } from "@/lib/server/alerts/service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function PATCH(request: Request, context: { params: Promise<{ policyId: string }> }) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = updateAlertPolicyRequestSchema.parse(await request.json());
    const { policyId } = await context.params;
    return NextResponse.json(await updateAlertPolicy(session, policyId, input));
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "alert_policy_update_failed", error instanceof Error ? error.message : "Unable to update alert policy.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ policyId: string }> }) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const { policyId } = await context.params;
    return NextResponse.json(await deleteAlertPolicy(session, policyId));
  } catch (error) {
    return errorResponse(400, "alert_policy_delete_failed", error instanceof Error ? error.message : "Unable to delete alert policy.");
  }
}
