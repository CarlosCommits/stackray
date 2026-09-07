import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createResendOauthAuthorization,
  exchangeResendAuthorizationCode,
  refreshResendOauthToken,
  ResendOauthRequestError,
  revokeResendOauthGrant,
} from "@/lib/server/email/resend-oauth";

afterEach(() => vi.unstubAllGlobals());

describe("Resend OAuth", () => {
  it("registers a public PKCE client with send-only access", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ client_id: "client-1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createResendOauthAuthorization(
      "https://stackray.example/api/v1/settings/alerts/email-provider/callback",
    );

    const registration = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(registration).toMatchObject({
      scope: "emails:send",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
    });
    expect(result.authorizationUrl.origin + result.authorizationUrl.pathname).toBe("https://api.resend.com/oauth/authorize");
    expect(result.authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(result.authorizationUrl.searchParams.get("scope")).toBe("emails:send");
    expect(result.state.codeVerifier).not.toBe(result.authorizationUrl.searchParams.get("code_challenge"));
  });

  it("exchanges and revokes the persistent authorization without a client secret", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 900,
        scope: "emails:send",
        token_type: "Bearer",
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await exchangeResendAuthorizationCode({
      state: "state",
      codeVerifier: "verifier",
      clientId: "client-1",
      redirectUri: "https://stackray.example/callback",
    }, "code");
    await revokeResendOauthGrant("client-1", token.refresh_token);

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("code_verifier=verifier");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("token_type_hint=refresh_token");
  });

  it.each([
    [429, true],
    [503, true],
    [400, false],
  ] as const)("classifies OAuth status %s retryability", async (status, retryable) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: status === 400 ? "invalid_grant" : "provider_unavailable",
    }), {
      status,
      headers: { "content-type": "application/json" },
    })));

    const error = await refreshResendOauthToken("client-1", "refresh-token").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResendOauthRequestError);
    expect(error).toMatchObject({ retryable, statusCode: status });
  });

  it("treats transport failures as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network unavailable")));

    const error = await refreshResendOauthToken("client-1", "refresh-token").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ResendOauthRequestError);
    expect(error).toMatchObject({ retryable: true, statusCode: null });
  });
});
