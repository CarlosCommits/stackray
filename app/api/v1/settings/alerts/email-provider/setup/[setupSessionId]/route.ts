import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { getResendSetupSession } from "@/lib/server/email/settings-service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET(_: Request, context: { params: Promise<{ setupSessionId: string }> }) {
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const { setupSessionId } = await context.params;
    return NextResponse.json(await getResendSetupSession(actor, setupSessionId));
  } catch (error) {
    return errorResponse(400, "resend_setup_load_failed", error instanceof Error ? error.message : "Unable to load Resend setup.");
  }
}
