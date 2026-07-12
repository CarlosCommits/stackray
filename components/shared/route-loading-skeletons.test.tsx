import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  AccountSettingsLoadingSkeleton,
  ApiKeysSettingsLoadingSkeleton,
  ListRouteLoadingSkeleton,
  ScanDetailLoadingSkeleton,
  UsersSettingsLoadingSkeleton,
} from "@/components/shared/route-loading-skeletons"

describe("route loading skeletons", () => {
  it.each([
    ["list", <ListRouteLoadingSkeleton key="list" />, "Loading page"],
    ["scan detail", <ScanDetailLoadingSkeleton key="scan-detail" />, "Loading scan details"],
    ["account", <AccountSettingsLoadingSkeleton key="account" />, "Loading account settings"],
    ["API keys", <ApiKeysSettingsLoadingSkeleton key="api-keys" />, "Loading API keys"],
    ["users", <UsersSettingsLoadingSkeleton key="users" />, "Loading users"],
  ])("renders an accessible %s loading state", (_name, component, label) => {
    const { container } = render(component)

    expect(screen.getByRole("status", { name: label })).toBeTruthy()
    expect(container.querySelectorAll(".motion-safe\\:animate-pulse").length).toBeGreaterThan(0)
  })

  it.each([
    <ListRouteLoadingSkeleton key="list" />,
    <ApiKeysSettingsLoadingSkeleton key="api-keys" />,
    <UsersSettingsLoadingSkeleton key="users" />,
  ])("includes distinct mobile and desktop structures", (component) => {
    const { container } = render(component)

    expect(container.querySelector('[data-loading-viewport="mobile"]')).toBeTruthy()
    expect(container.querySelector('[data-loading-viewport="desktop"]')).toBeTruthy()
  })
})
