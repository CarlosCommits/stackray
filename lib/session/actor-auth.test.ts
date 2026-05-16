import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ActorContext } from "@/lib/session/actor-context"
import { getActorContext, resolveBearerActor } from "@/lib/session/actor-context"

import { actorAuthErrorResponse, requireSessionOrBearerActor } from "./actor-auth"

vi.mock("@/lib/session/actor-context", () => ({
  getActorContext: vi.fn(),
  resolveBearerActor: vi.fn(),
}))

const getActorContextMock = vi.mocked(getActorContext)
const resolveBearerActorMock = vi.mocked(resolveBearerActor)

const sessionActor: ActorContext = {
  user: {
    id: "usr_session",
    email: "session@example.com",
    displayName: "Session User",
    image: null,
    role: "user",
  },
  apiTokenAccessEnabled: true,
  requiresPasswordChange: false,
  source: "ui",
  token: null,
}

const bearerActor: ActorContext = {
  user: {
    id: "usr_bearer",
    email: "bearer@example.com",
    displayName: "Bearer User",
    image: null,
    role: "user",
  },
  apiTokenAccessEnabled: true,
  requiresPasswordChange: false,
  source: "api",
  token: {
    id: "tok_123",
    name: "Automation token",
  },
}

function requestWithAuthorization(authorization: string | null) {
  const headers = new Headers()

  if (authorization !== null) {
    headers.set("authorization", authorization)
  }

  return new Request("https://stackray.test/api/v1/scans", { headers })
}

async function getActorAuthErrorPayload(operation: Promise<unknown>) {
  try {
    await operation
  } catch (error) {
    const response = actorAuthErrorResponse(error)

    if (!response) {
      throw error
    }

    return {
      status: response.status,
      body: await response.json(),
    }
  }

  throw new Error("Expected the operation to fail with an actor auth error.")
}

describe("requireSessionOrBearerActor", () => {
  beforeEach(() => {
    getActorContextMock.mockReset()
    resolveBearerActorMock.mockReset()
  })

  it("resolves a bearer actor when a valid bearer token is supplied", async () => {
    resolveBearerActorMock.mockResolvedValue(bearerActor)

    await expect(requireSessionOrBearerActor(requestWithAuthorization("Bearer sr_live_valid")))
      .resolves.toBe(bearerActor)

    expect(resolveBearerActorMock).toHaveBeenCalledWith("sr_live_valid", "api")
    expect(getActorContextMock).not.toHaveBeenCalled()
  })

  it("prefers bearer auth over session fallback when both could be available", async () => {
    resolveBearerActorMock.mockResolvedValue(bearerActor)
    getActorContextMock.mockResolvedValue(sessionActor)

    await expect(requireSessionOrBearerActor(requestWithAuthorization("Bearer sr_live_valid")))
      .resolves.toBe(bearerActor)

    expect(getActorContextMock).not.toHaveBeenCalled()
  })

  it("falls back to the browser session actor when no bearer token is supplied", async () => {
    getActorContextMock.mockResolvedValue(sessionActor)

    await expect(requireSessionOrBearerActor(requestWithAuthorization(null)))
      .resolves.toBe(sessionActor)

    expect(getActorContextMock).toHaveBeenCalledWith("ui")
    expect(resolveBearerActorMock).not.toHaveBeenCalled()
  })

  it("returns invalid_authorization_header for malformed bearer headers", async () => {
    const { status, body } = await getActorAuthErrorPayload(
      requireSessionOrBearerActor(requestWithAuthorization("Bearer token extra")),
    )

    expect(status).toBe(401)
    expect(body.error.code).toBe("invalid_authorization_header")
    expect(resolveBearerActorMock).not.toHaveBeenCalled()
    expect(getActorContextMock).not.toHaveBeenCalled()
  })

  it("returns invalid_api_token when bearer resolution fails", async () => {
    resolveBearerActorMock.mockResolvedValue(null)

    const { status, body } = await getActorAuthErrorPayload(
      requireSessionOrBearerActor(requestWithAuthorization("Bearer sr_live_revoked")),
    )

    expect(status).toBe(401)
    expect(body.error.code).toBe("invalid_api_token")
    expect(getActorContextMock).not.toHaveBeenCalled()
  })

  it("returns unauthenticated when neither bearer nor session auth is available", async () => {
    getActorContextMock.mockResolvedValue(null)

    const { status, body } = await getActorAuthErrorPayload(
      requireSessionOrBearerActor(requestWithAuthorization(null)),
    )

    expect(status).toBe(401)
    expect(body.error.code).toBe("unauthenticated")
  })

  it("ignores non-auth errors in the auth error response adapter", () => {
    expect(actorAuthErrorResponse(new Error("Not an auth error"))).toBeNull()
  })
})
