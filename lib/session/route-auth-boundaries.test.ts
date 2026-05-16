import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const sharedProductRoutes = [
  "app/api/v1/scans/route.ts",
  "app/api/v1/scans/[scanId]/route.ts",
  "app/api/v1/scans/[scanId]/events/route.ts",
  "app/api/v1/scans/[scanId]/results/route.ts",
  "app/api/v1/scans/[scanId]/results/[resultId]/screenshot/route.ts",
  "app/api/v1/scans/[scanId]/results/[resultId]/technologies/route.ts",
  "app/api/v1/scans/[scanId]/technologies/route.ts",
  "app/api/v1/runs/route.ts",
  "app/api/v1/targets/results/route.ts",
  "app/api/v1/targets/[canonicalTargetId]/history/route.ts",
  "app/api/v1/targets/[canonicalTargetId]/technologies/route.ts",
  "app/api/v1/schedules/route.ts",
  "app/api/v1/schedules/[scheduleId]/route.ts",
]

const sessionOnlyAccountRoutes = [
  "app/api/v1/tokens/route.ts",
  "app/api/v1/tokens/[tokenId]/route.ts",
  "app/api/v1/settings/users/route.ts",
  "app/api/v1/settings/users/[userId]/route.ts",
  "app/api/v1/settings/users/[userId]/password/route.ts",
  "app/api/v1/auth/change-password/route.ts",
  "app/api/v1/me/product-state/route.ts",
]

async function readRoute(relativePath: string) {
  return readFile(join(process.cwd(), relativePath), "utf8")
}

describe("API route auth boundaries", () => {
  it.each(sharedProductRoutes)("keeps %s on the shared session-or-bearer boundary", async (routePath) => {
    const source = await readRoute(routePath)

    expect(source).toContain("@/lib/session/actor-auth")
    expect(source).toContain("requireSessionOrBearerActor")
    expect(source).not.toContain("requireAppSession")
  })

  it.each(sessionOnlyAccountRoutes)("keeps %s session-only", async (routePath) => {
    const source = await readRoute(routePath)

    expect(source).toContain("@/lib/session/app-session")
    expect(source).toContain("requireAppSession")
    expect(source).not.toContain("@/lib/session/actor-auth")
    expect(source).not.toContain("requireSessionOrBearerActor")
  })
})
