import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ReleaseNoticeShell } from "@/components/shell/release-notice-shell"
import { APP_VERSION } from "@/lib/version"

let searchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}))

describe("ReleaseNoticeShell", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
    vi.restoreAllMocks()
  })

  it("forces the post-update notice in dev preview mode without persisting dismissal", async () => {
    const fetchSpy = vi.spyOn(window, "fetch")
    searchParams = new URLSearchParams("stackrayPostUpdatePreview=1")

    render(
      <ReleaseNoticeShell
        enableDevPreview
        lastSeenReleaseVersion={APP_VERSION}
        currentRelease={{
          version: APP_VERSION,
          title: "Local post-update preview",
          body: "Preview release notes.",
          url: "https://github.com/CarlosCommits/stackray/releases",
          publishedAt: "2026-05-08T00:00:00.000Z",
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "View notes" }))

    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByText("Local post-update preview")).toBeTruthy()
    expect(screen.getByText("Preview release notes.")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Got it" }))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.queryByText(`What's new in v${APP_VERSION}`)).toBeNull()
  })
})
