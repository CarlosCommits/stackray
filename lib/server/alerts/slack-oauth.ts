import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

export const SLACK_OAUTH_COOKIE = "stackray_slack_oauth";
export const STACKRAY_SLACK_RELAY_ORIGIN = "https://stackray.app";
export const STACKRAY_SLACK_REDIRECT_URI = `${STACKRAY_SLACK_RELAY_ORIGIN}/integrations/slack/callback`;
const STACKRAY_SLACK_CONFIG_URL = `${STACKRAY_SLACK_RELAY_ORIGIN}/api/integrations/slack/config`;
const SLACK_API_ORIGIN = "https://slack.com";
const OFFICIAL_APP_CONFIG_TIMEOUT_MS = 5_000;
const OFFICIAL_APP_UNAVAILABLE_MESSAGE = "The official Stackray Slack app could not be reached. Add the channel with a Slack webhook URL instead.";

const officialAppConfigSchema = z.object({
  clientId: z.string().min(1),
  redirectUri: z.literal(STACKRAY_SLACK_REDIRECT_URI),
});

const slackTokenResponseSchema = z.object({
  ok: z.literal(true),
  scope: z.string().min(1),
  team: z.object({ id: z.string().min(1), name: z.string().min(1) }),
  incoming_webhook: z.object({
    channel: z.string().min(1),
    channel_id: z.string().min(1),
    configuration_url: z.url(),
    url: z.url(),
  }),
});

export type SlackOauthState = {
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: typeof STACKRAY_SLACK_REDIRECT_URI;
  existingChannelId?: string;
};

async function readSlackResponse<T>(response: Response, schema: z.ZodType<T>) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = z.object({ error: z.string().optional(), message: z.string().optional() }).safeParse(payload);
    throw new Error(parsed.success
      ? parsed.data.message ?? parsed.data.error ?? "Slack rejected the request."
      : "Slack rejected the request.");
  }
  return schema.parse(payload);
}

export async function getOfficialSlackAppConfig(
  fetchImpl: typeof fetch = fetch,
  configUrl = STACKRAY_SLACK_CONFIG_URL,
  timeoutMs = OFFICIAL_APP_CONFIG_TIMEOUT_MS,
) {
  let response: Response;
  try {
    response = await fetchImpl(configUrl, {
      headers: { accept: "application/json", "user-agent": "stackray-slack-setup" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error(OFFICIAL_APP_UNAVAILABLE_MESSAGE);
  }
  if (!response.ok) {
    throw new Error(OFFICIAL_APP_UNAVAILABLE_MESSAGE);
  }
  return officialAppConfigSchema.parse(await response.json());
}

export function createSlackOauthAuthorization(
  config: z.infer<typeof officialAppConfigSchema>,
  existingChannelId?: string,
) {
  const codeVerifier = randomBytes(64).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authorizationUrl = new URL(`${SLACK_API_ORIGIN}/oauth/v2/authorize`);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("scope", "incoming-webhook");
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl,
    state: {
      state,
      codeVerifier,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      ...(existingChannelId ? { existingChannelId } : {}),
    } satisfies SlackOauthState,
  };
}

export async function exchangeSlackAuthorizationCode(
  oauthState: SlackOauthState,
  code: string,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(`${SLACK_API_ORIGIN}/api/oauth.v2.access`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "stackray-slack-setup",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: oauthState.clientId,
      code,
      redirect_uri: oauthState.redirectUri,
      code_verifier: oauthState.codeVerifier,
    }),
    cache: "no-store",
  });
  const token = await readSlackResponse(response, slackTokenResponseSchema);
  const scopes = token.scope.split(",").map((scope) => scope.trim()).filter(Boolean);
  if (scopes.length !== 1 || scopes[0] !== "incoming-webhook") {
    throw new Error("The Stackray Slack app requested unexpected permissions. No Slack credentials were saved.");
  }
  return token;
}
