import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  authChangePassword: vi.fn(),
  dbUpdate: vi.fn(),
  headers: vi.fn(async () => new Headers()),
  requireAppSession: vi.fn(),
}))

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}))

vi.mock("@/lib/auth/better-auth", () => ({
  auth: {
    api: {
      changePassword: mocks.authChangePassword,
    },
  },
}))

vi.mock("@/lib/db/client", () => ({
  db: {
    update: mocks.dbUpdate,
  },
}))

vi.mock("@/lib/session/app-session", () => ({
  requireAppSession: mocks.requireAppSession,
}))

function createQueryChain<T>(result: T) {
  const promise = Promise.resolve(result)
  const chain = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
    [Symbol.toStringTag]: "Promise",
  }

  return chain
}

function request(body: unknown) {
  return new Request("https://stackray.test/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/v1/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authChangePassword.mockResolvedValue({ ok: true })
    mocks.dbUpdate.mockReturnValue(createQueryChain([]))
    mocks.headers.mockResolvedValue(new Headers())
    mocks.requireAppSession.mockResolvedValue({
      user: {
        id: "11111111-1111-4111-8111-111111111111",
      },
    })
  })

  it("changes the current user's password and revokes other sessions by default", async () => {
    const { POST } = await import("./route")

    const response = await POST(request({
      currentPassword: "CurrentPassword123!",
      newPassword: "NewPassword123!",
    }))

    expect(response.status).toBe(200)
    expect(mocks.authChangePassword).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123!",
        revokeOtherSessions: true,
      },
    }))
    const updateChain = mocks.dbUpdate.mock.results[0]?.value
    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({
      passwordChangeRequiredAt: null,
      updatedAt: expect.any(Date),
    }))
  })

  it("passes an explicit session revocation choice through to Better Auth", async () => {
    const { POST } = await import("./route")

    await POST(request({
      currentPassword: "CurrentPassword123!",
      newPassword: "NewPassword123!",
      revokeOtherSessions: false,
    }))

    expect(mocks.authChangePassword).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        revokeOtherSessions: false,
      }),
    }))
  })

  it("rejects short new passwords", async () => {
    const { POST } = await import("./route")

    const response = await POST(request({
      currentPassword: "CurrentPassword123!",
      newPassword: "short",
    }))

    expect(response.status).toBe(400)
    expect(mocks.authChangePassword).not.toHaveBeenCalled()
  })
})
