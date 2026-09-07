import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { testAlertChannel } from "@/lib/server/alerts/service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function POST(_: Request, context: { params: Promise<{ channelId: string }> }) {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const { channelId } = await context.params;
    return NextResponse.json(await testAlertChannel(session, channelId));
  } catch (error) {
    return errorResponse(400, "alert_channel_test_failed", error instanceof Error ? error.message : "Unable to test notification channel.");
  }
}
