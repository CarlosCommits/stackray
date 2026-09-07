import { describe, expect, it, vi } from "vitest";

import {
  createSlackOauthAuthorization,
  exchangeSlackAuthorizationCode,
  getOfficialSlackAppConfig,
  STACKRAY_SLACK_REDIRECT_URI,
} from "./slack-oauth.ts";

describe("Slack OAuth", () => {
  it("creates a PKCE authorization requesting only incoming webhooks", () => {
    const authorization = createSlackOauthAuthorization({
      clientId: "123.456",
      redirectUri: STACKRAY_SLACK_REDIRECT_URI,
    });
    expect(authorization.authorizationUrl.origin).toBe("https://slack.com");
    expect(authorization.authorizationUrl.searchParams.get("scope")).toBe("incoming-webhook");
    expect(authorization.authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.authorizationUrl.searchParams.get("redirect_uri")).toBe(STACKRAY_SLACK_REDIRECT_URI);
    expect(authorization.authorizationUrl.searchParams.get("code_challenge")).not.toBe(authorization.state.codeVerifier);
  });

  it("loads the public client id from the official relay", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      clientId: "123.456",
      redirectUri: STACKRAY_SLACK_REDIRECT_URI,
    }), { status: 200 }));
    await expect(getOfficialSlackAppConfig(
      fetchMock as unknown as typeof fetch,
      "https://relay.example/config",
    )).resolves.toEqual({ clientId: "123.456", redirectUri: STACKRAY_SLACK_REDIRECT_URI });
  });

  it("fails quickly with the manual-webhook fallback when the official relay stalls", async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
    }));

    await expect(getOfficialSlackAppConfig(
      fetchMock as unknown as typeof fetch,
      "https://relay.example/config",
      5,
    )).rejects.toThrow("Add the channel with a Slack webhook URL instead");
  });

  it("exchanges the code with PKCE and rejects broader permissions", async () => {
    const tokenResponse = (scope: string) => new Response(JSON.stringify({
      ok: true,
      scope,
      team: { id: "T1", name: "Acme" },
      incoming_webhook: {
        channel: "#security",
        channel_id: "C1",
        configuration_url: "https://acme.slack.com/services/B1",
        url: "https://hooks.slack.com/services/T1/B1/secret",
      },
    }), { status: 200 });
    const state = {
      state: "state",
      codeVerifier: "verifier",
      clientId: "123.456",
      redirectUri: STACKRAY_SLACK_REDIRECT_URI,
    } as const;
    const fetchMock = vi.fn<typeof fetch>(async () => tokenResponse("incoming-webhook"));
    await expect(exchangeSlackAuthorizationCode(state, "code", fetchMock as unknown as typeof fetch))
      .resolves.toMatchObject({ team: { name: "Acme" } });
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain("code_verifier=verifier");

    await expect(exchangeSlackAuthorizationCode(
      state,
      "code",
      vi.fn(async () => tokenResponse("incoming-webhook,chat:write")) as unknown as typeof fetch,
    )).rejects.toThrow("unexpected permissions");
  });
});
