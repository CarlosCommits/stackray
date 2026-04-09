import { fireEvent, render, screen } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { ReleaseNotice } from "@/components/shell/release-notice"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("ReleaseNotice", () => {
  it("shows the current release when the user has not seen it", () => {
    const onDismiss = vi.fn()

    render(<ReleaseNotice currentVersion="0.1.0" lastSeenVersion={null} onDismiss={onDismiss} />)

    expect(screen.getByText("What's new in v0.1.0")).toBeInTheDocument()
  })

  it("hides the notice after dismissing it", () => {
    const onDismiss = vi.fn()

    render(<ReleaseNotice currentVersion="0.1.0" lastSeenVersion={null} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }))

    expect(onDismiss).toHaveBeenCalledWith("0.1.0")
    expect(screen.queryByText("What's new in v0.1.0")).not.toBeInTheDocument()
  })
})
