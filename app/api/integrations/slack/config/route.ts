import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { STACKRAY_SLACK_REDIRECT_URI } from "@/lib/server/alerts/slack-oauth";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET() {
  if (!env.STACKRAY_SLACK_CLIENT_ID) {
    return errorResponse(503, "slack_app_unavailable", "The official Stackray Slack app is not configured.");
  }

  return NextResponse.json({
    clientId: env.STACKRAY_SLACK_CLIENT_ID,
    redirectUri: STACKRAY_SLACK_REDIRECT_URI,
  }, {
    headers: { "cache-control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
