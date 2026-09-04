import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createAlertChannelRequestSchema } from "@/lib/contracts/alerts";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { DEMO_MOCK_ALERT_CHANNELS } from "@/lib/demo-mode-data";
import { requireAppSession } from "@/lib/session/app-session";
import { createAlertChannel, listAlertChannels } from "@/lib/server/alerts/service";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

export async function GET() {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) return NextResponse.json({ items: DEMO_MOCK_ALERT_CHANNELS });
    return NextResponse.json(await listAlertChannels(session));
  } catch (error) {
    return errorResponse(403, "alert_channel_access_denied", error instanceof Error ? error.message : "Forbidden");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = createAlertChannelRequestSchema.parse(await request.json());
    return NextResponse.json(await createAlertChannel(session, input), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "alert_channel_create_failed", error instanceof Error ? error.message : "Unable to create notification channel.");
  }
}
