import { render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { ReleaseNotesMarkdown } from "@/components/shell/release-notes-markdown"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("ReleaseNotesMarkdown", () => {
  it("renders Release Please markdown as structured notes", () => {
    render(
      <ReleaseNotesMarkdown
        markdown={[
          "## [0.2.0](https://github.com/CarlosCommits/stackray/compare/v0.1.0...v0.2.0) (2026-07-04)",
          "",
          "### Features",
          "",
          "* **scans:** expand custom technology metadata ([de653ea](https://github.com/CarlosCommits/stackray/commit/de653ea6760d019e4bd60d0a336fa052e3ba8aef))",
          "* **settings:** add `account` password page",
        ].join("\n")}
      />,
    )

    expect(screen.getByRole("link", { name: "0.2.0" })).toHaveAttribute(
      "href",
      "https://github.com/CarlosCommits/stackray/compare/v0.1.0...v0.2.0",
    )
    expect(screen.getByText("Features")).toBeInTheDocument()
    expect(screen.getByText("scans:")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "de653ea" })).toBeInTheDocument()
    expect(screen.getByText("account")).toBeInTheDocument()
    expect(screen.queryByText(/^\* \*\*scans/)).not.toBeInTheDocument()
  })

  it("renders numbered release steps", () => {
    render(
      <ReleaseNotesMarkdown
        markdown={[
          "1. Open the Railway project.",
          "2. Run `Deploy Latest Commit`.",
        ].join("\n")}
      />,
    )

    const list = screen.getByRole("list")
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("Deploy Latest Commit")).toBeInTheDocument()
  })
})
