import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const sharedProductRoutes = [
  "app/api/v1/dashboard/recent-scans/route.ts",
  "app/api/v1/image-proxy/route.ts",
  "app/api/v1/scans/route.ts",
  "app/api/v1/scans/[scanId]/route.ts",
  "app/api/v1/scans/[scanId]/events/route.ts",
  "app/api/v1/scans/[scanId]/report/route.ts",
  "app/api/v1/scans/[scanId]/results/route.ts",
  "app/api/v1/scans/[scanId]/results/[resultId]/favicon/route.ts",
  "app/api/v1/scans/[scanId]/results/[resultId]/screenshot/route.ts",
  "app/api/v1/scans/[scanId]/results/[resultId]/technologies/route.ts",
  "app/api/v1/scans/[scanId]/subdomains/route.ts",
  "app/api/v1/scans/[scanId]/technologies/route.ts",
  "app/api/v1/runs/route.ts",
  "app/api/v1/targets/filter-options/route.ts",
  "app/api/v1/targets/results/route.ts",
  "app/api/v1/targets/[canonicalTargetId]/history/route.ts",
  "app/api/v1/targets/[canonicalTargetId]/technologies/route.ts",
  "app/api/v1/targets/technology-comparison/route.ts",
  "app/api/v1/targets/technology-options/route.ts",
  "app/api/v1/schedules/route.ts",
  "app/api/v1/schedules/[scheduleId]/route.ts",
]

const sessionOnlyAccountRoutes = [
  "app/api/v1/api-keys/route.ts",
  "app/api/v1/api-keys/[apiKeyId]/route.ts",
  "app/api/v1/settings/users/route.ts",
  "app/api/v1/settings/users/[userId]/route.ts",
  "app/api/v1/settings/users/[userId]/password/route.ts",
  "app/api/v1/auth/change-password/route.ts",
  "app/api/v1/me/product-state/route.ts",
]

async function readRoute(relativePath: string) {
  return readFile(join(process.cwd(), relativePath), "utf8")
}

async function listRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(join(process.cwd(), directory), { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = `${directory}/${entry.name}`

    if (entry.isDirectory()) {
      return listRouteFiles(relativePath)
    }

    return entry.isFile() && entry.name === "route.ts" ? [relativePath] : []
  }))

  return nested.flat()
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

  it("classifies every bearer-authenticated API route", async () => {
    const routeFiles = await listRouteFiles("app/api/v1")
    const bearerRoutes = await Promise.all(routeFiles.map(async (routePath) => {
      const source = await readRoute(routePath)

      return source.includes("requireSessionOrBearerActor") ? routePath : null
    }))

    expect(bearerRoutes.filter((routePath): routePath is string => routePath !== null).toSorted())
      .toEqual(sharedProductRoutes.toSorted())
  })

  it("classifies every session-only API route", async () => {
    const routeFiles = await listRouteFiles("app/api/v1")
    const sessionRoutes = await Promise.all(routeFiles.map(async (routePath) => {
      const source = await readRoute(routePath)

      return source.includes("requireAppSession") ? routePath : null
    }))

    expect(sessionRoutes.filter((routePath): routePath is string => routePath !== null).toSorted())
      .toEqual(sessionOnlyAccountRoutes.toSorted())
  })
})
