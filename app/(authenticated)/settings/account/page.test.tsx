import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  isDemoModeEnabled: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  requireAppSession: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}))

vi.mock("@/lib/demo-mode", () => ({
  isDemoModeEnabled: mocks.isDemoModeEnabled,
}))

vi.mock("@/lib/session/app-session", () => ({
  requireAppSession: mocks.requireAppSession,
}))

vi.mock("@/components/settings/account/account-page-client", () => ({
  AccountPageClient: ({ user }: { user: { displayName: string; email: string } }) => (
    <div data-testid="account-page-client">{user.email}</div>
  ),
}))

describe("AccountPage", () => {
  it("is not available in demo mode", async () => {
    mocks.isDemoModeEnabled.mockReturnValue(true)
    const { default: AccountPage } = await import("./page")

    await expect(AccountPage()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(mocks.notFound).toHaveBeenCalled()
    expect(mocks.requireAppSession).not.toHaveBeenCalled()
  })

  it("renders for real authenticated sessions", async () => {
    mocks.isDemoModeEnabled.mockReturnValue(false)
    mocks.requireAppSession.mockResolvedValue({
      user: {
        displayName: "Ada Lovelace",
        email: "ada@example.com",
      },
    })
    const { default: AccountPage } = await import("./page")

    await expect(AccountPage()).resolves.toMatchObject({
      type: expect.any(Function),
    })
    expect(mocks.requireAppSession).toHaveBeenCalled()
  })
})
