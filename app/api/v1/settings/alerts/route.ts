import { NextResponse } from "next/server";

import { requireAppSession } from "@/lib/session/app-session";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import {
  DEMO_MOCK_ALERT_CHANNELS,
  DEMO_MOCK_ALERT_POLICIES,
  DEMO_MOCK_ALERT_READINESS,
  DEMO_MOCK_EMAIL_PROVIDER,
} from "@/lib/demo-mode-data";
import { getAlertSettingsSnapshot } from "@/lib/server/alerts/service";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET() {
  try {
    const session = await requireAppSession();
    if (isDemoModeEnabled()) {
      return NextResponse.json({
        readiness: DEMO_MOCK_ALERT_READINESS,
        emailProvider: DEMO_MOCK_EMAIL_PROVIDER,
        channels: DEMO_MOCK_ALERT_CHANNELS,
        policies: DEMO_MOCK_ALERT_POLICIES,
      });
    }
    return NextResponse.json(await getAlertSettingsSnapshot(session));
  } catch (error) {
    return errorResponse(403, "alert_settings_access_denied", error instanceof Error ? error.message : "Forbidden");
  }
}
