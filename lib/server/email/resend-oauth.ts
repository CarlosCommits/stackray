import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

const RESEND_API_ORIGIN = "https://api.resend.com";
export const RESEND_OAUTH_COOKIE = "stackray_resend_oauth";

const clientRegistrationSchema = z.object({ client_id: z.string().min(1) });
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().min(1),
  token_type: z.string().min(1),
});

export interface ResendOauthState {
  state: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}

async function readOauthResponse<T>(response: Response, schema: z.ZodType<T>) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = z.object({ error_description: z.string().optional(), error: z.string().optional() })
      .safeParse(payload);
    throw new Error(detail.success
      ? detail.data.error_description ?? detail.data.error ?? "Resend rejected the OAuth request."
      : "Resend rejected the OAuth request.");
  }
  return schema.parse(payload);
}

export async function createResendOauthAuthorization(
  redirectUri: string,
) {
  const registrationResponse = await fetch(`${RESEND_API_ORIGIN}/oauth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "stackray-resend-setup",
    },
    body: JSON.stringify({
      client_name: "Stackray",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "emails:send",
    }),
    cache: "no-store",
  });
  const registration = await readOauthResponse(registrationResponse, clientRegistrationSchema);

  const codeVerifier = randomBytes(64).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const authorizationUrl = new URL(`${RESEND_API_ORIGIN}/oauth/authorize`);
  authorizationUrl.searchParams.set("client_id", registration.client_id);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("scope", "emails:send");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  return {
    authorizationUrl,
    state: {
      state,
      codeVerifier,
      clientId: registration.client_id,
      redirectUri,
    } satisfies ResendOauthState,
  };
}

export async function exchangeResendAuthorizationCode(
  oauthState: ResendOauthState,
  code: string,
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: oauthState.clientId,
    code,
    redirect_uri: oauthState.redirectUri,
    code_verifier: oauthState.codeVerifier,
  });
  const response = await fetch(`${RESEND_API_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "stackray-resend-setup",
    },
    body,
    cache: "no-store",
  });
  return readOauthResponse(response, tokenResponseSchema);
}

export async function refreshResendOauthToken(clientId: string, refreshToken: string) {
  const response = await fetch(`${RESEND_API_ORIGIN}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "stackray-resend-setup",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });
  return readOauthResponse(response, tokenResponseSchema);
}

export async function revokeResendOauthGrant(clientId: string, refreshToken: string) {
  const response = await fetch(`${RESEND_API_ORIGIN}/oauth/revoke`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": "stackray-resend-setup",
    },
    body: new URLSearchParams({
      client_id: clientId,
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Resend could not revoke Stackray's authorization.");
}
