import { NextResponse } from "next/server";

import { env } from "@/lib/env/server";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { buildAbsoluteUrl, derivePublicOriginFromHeaders } from "@/lib/public-origin";
import { requireAppSession } from "@/lib/session/app-session";
import { createResendOauthAuthorization, RESEND_OAUTH_COOKIE } from "@/lib/server/email/resend-oauth";
import { errorResponse } from "@/lib/server/http/error-response";

export async function GET(request: Request) {
  try {
    await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const origin = derivePublicOriginFromHeaders(request.headers);
    if (!origin) throw new Error("Configure BETTER_AUTH_URL before connecting Resend.");
    const redirectUri = buildAbsoluteUrl("/api/v1/settings/alerts/email-provider/callback", origin);
    const authorization = await createResendOauthAuthorization(redirectUri);
    const response = NextResponse.redirect(authorization.authorizationUrl);
    response.cookies.set(RESEND_OAUTH_COOKIE, Buffer.from(JSON.stringify(authorization.state)).toString("base64url"), {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/api/v1/settings/alerts/email-provider/callback",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    return errorResponse(400, "resend_connect_failed", error instanceof Error ? error.message : "Unable to connect Resend.");
  }
}
