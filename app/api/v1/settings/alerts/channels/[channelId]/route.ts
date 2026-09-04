import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateAlertChannelRequestSchema } from "@/lib/contracts/alerts";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { requireAppSession } from "@/lib/session/app-session";
import { deleteAlertChannel, updateAlertChannel } from "@/lib/server/alerts/service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function PATCH(request: Request, context: { params: Promise<{ channelId: string }> }) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = updateAlertChannelRequestSchema.parse(await request.json());
    const { channelId } = await context.params;
    return NextResponse.json(await updateAlertChannel(session, channelId, input));
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "alert_channel_update_failed", error instanceof Error ? error.message : "Unable to update notification channel.");
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ channelId: string }> }) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const { channelId } = await context.params;
    return NextResponse.json(await deleteAlertChannel(session, channelId));
  } catch (error) {
    return errorResponse(400, "alert_channel_delete_failed", error instanceof Error ? error.message : "Unable to delete notification channel.");
  }
}
