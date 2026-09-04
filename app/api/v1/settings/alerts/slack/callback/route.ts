import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { requireAppSession } from "@/lib/session/app-session";
import { DEMO_DEPLOYMENT_REQUIRED_MESSAGE, isDemoModeEnabled } from "@/lib/demo-mode";
import { connectSlackAlertChannel } from "@/lib/server/alerts/service";
import {
  exchangeSlackAuthorizationCode,
  SLACK_OAUTH_COOKIE,
  type SlackOauthState,
} from "@/lib/server/alerts/slack-oauth";
import { errorResponse, zodErrorResponse } from "@/lib/server/http/error-response";

const requestSchema = z.object({ code: z.string().min(1), state: z.string().min(1) }).strict();
const oauthStateSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  clientId: z.string().min(1),
  redirectUri: z.literal("https://stackray.app/integrations/slack/callback"),
  existingChannelId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  try {
    const actor = await requireAppSession();
    if (isDemoModeEnabled()) {
      return errorResponse(403, "demo_feature_disabled", DEMO_DEPLOYMENT_REQUIRED_MESSAGE);
    }
    const input = requestSchema.parse(await request.json());
    const serializedState = cookieStore.get(SLACK_OAUTH_COOKIE)?.value;
    if (!serializedState) throw new Error("The Slack authorization session expired. Try connecting again.");
    const oauthState = oauthStateSchema.parse(
      JSON.parse(Buffer.from(serializedState, "base64url").toString("utf8")),
    ) as SlackOauthState;
    if (input.state !== oauthState.state) throw new Error("The Slack authorization response could not be verified.");
    const token = await exchangeSlackAuthorizationCode(oauthState, input.code);
    const channel = await connectSlackAlertChannel(actor, {
      existingChannelId: oauthState.existingChannelId,
      workspaceId: token.team.id,
      workspaceName: token.team.name,
      channelId: token.incoming_webhook.channel_id,
      channelName: token.incoming_webhook.channel,
      configurationUrl: token.incoming_webhook.configuration_url,
      webhookUrl: token.incoming_webhook.url,
    });
    cookieStore.delete(SLACK_OAUTH_COOKIE);
    return NextResponse.json(channel, { status: oauthState.existingChannelId ? 200 : 201 });
  } catch (error) {
    cookieStore.delete(SLACK_OAUTH_COOKIE);
    if (error instanceof ZodError) return zodErrorResponse(error);
    return errorResponse(400, "slack_callback_failed", error instanceof Error ? error.message : "Unable to finish connecting Slack.");
  }
}
