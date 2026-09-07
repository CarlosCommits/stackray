import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAbsoluteUrl, derivePublicOriginFromHeaders } from "@/lib/public-origin";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { requireAppSession } from "@/lib/session/app-session";
import {
  createResendSetupSession,
} from "@/lib/server/email/settings-service";
import {
  exchangeResendAuthorizationCode,
  RESEND_OAUTH_COOKIE,
  type ResendOauthState,
} from "@/lib/server/email/resend-oauth";

const callbackQuerySchema = z.object({ code: z.string().min(1), state: z.string().min(1) });
const oauthStateSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.url(),
});

function settingsRedirect(request: Request, params: Record<string, string>) {
  const origin = derivePublicOriginFromHeaders(request.headers) ?? new URL(request.url).origin;
  const url = new URL(buildAbsoluteUrl("/settings/alerts", origin));
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return settingsRedirect(request, { resendError: DEMO_DEPLOYMENT_REQUIRED_MESSAGE });
    }
    const query = callbackQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const serializedState = cookieStore.get(RESEND_OAUTH_COOKIE)?.value;
    if (!serializedState) throw new Error("The Resend authorization session expired.");
    const oauthState = oauthStateSchema.parse(JSON.parse(Buffer.from(serializedState, "base64url").toString("utf8"))) as ResendOauthState;
    if (query.state !== oauthState.state) throw new Error("The Resend authorization response could not be verified.");
    const token = await exchangeResendAuthorizationCode(oauthState, query.code);
    const setupSession = await createResendSetupSession(actor, {
      clientId: oauthState.clientId,
      oauthScope: token.scope,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
    });
    cookieStore.delete(RESEND_OAUTH_COOKIE);

    return settingsRedirect(request, { resendSetup: setupSession.id });
  } catch (error) {
    cookieStore.delete(RESEND_OAUTH_COOKIE);
    return settingsRedirect(request, {
      resendError: error instanceof Error ? error.message : "Resend setup could not be completed.",
    });
  }
}
