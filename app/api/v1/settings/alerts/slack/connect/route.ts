import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { env } from "@/lib/env/server";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { requireAppSession } from "@/lib/session/app-session";
import {
  createSlackOauthAuthorization,
  getOfficialSlackAppConfig,
  SLACK_OAUTH_COOKIE,
} from "@/lib/server/alerts/slack-oauth";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

const requestSchema = z.object({ existingChannelId: z.string().uuid().optional() }).strict();

export async function POST(request: Request) {
  try {
    await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = requestSchema.parse(await request.json().catch(() => ({})));
    const authorization = createSlackOauthAuthorization(
      await getOfficialSlackAppConfig(),
      input.existingChannelId,
    );
    const response = NextResponse.json({ authorizationUrl: authorization.authorizationUrl.toString() });
    response.cookies.set(SLACK_OAUTH_COOKIE, Buffer.from(JSON.stringify(authorization.state)).toString("base64url"), {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/api/v1/settings/alerts/slack",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "slack_connect_failed", error instanceof Error ? error.message : "Unable to connect Slack.");
  }
}
