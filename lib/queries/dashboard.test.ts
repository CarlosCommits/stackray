import { describe, expect, it, vi } from "vitest"

import { getDashboardSnapshot } from "@/lib/queries/dashboard"
import { requireAppSession } from "@/lib/session/app-session"
import { getDashboardRecentScansPage, getDashboardStats } from "@/lib/server/scans/read-service"

const { actor } = vi.hoisted(() => ({
  actor: { userId: "user-1", workspaceId: "workspace-1" },
}))

vi.mock("@/lib/session/app-session", () => ({
  requireAppSession: vi.fn(async () => actor),
}))

vi.mock("@/lib/server/scans/read-service", () => ({
  getDashboardRecentScansPage: vi.fn(async () => ({ items: [], nextCursor: "16" })),
  getDashboardStats: vi.fn(async () => []),
}))

describe("getDashboardSnapshot", () => {
  it("bounds the initial dashboard recent-scan fetch to 16 items", async () => {
    const snapshot = await getDashboardSnapshot()

    expect(requireAppSession).toHaveBeenCalledOnce()
    expect(getDashboardRecentScansPage).toHaveBeenCalledWith(actor, { limit: 16 })
    expect(getDashboardStats).toHaveBeenCalledWith(actor)
    expect(snapshot.recentScansNextCursor).toBe("16")
  })
})
