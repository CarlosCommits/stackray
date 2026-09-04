import { render, screen, within } from "@testing-library/react"
import { beforeAll, describe, expect, it } from "vitest"

import { SetCookieEvidence } from "@/components/changes/set-cookie-evidence"
import { TooltipProvider } from "@/components/ui/tooltip"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

function renderEvidence(beforeValues: string[], afterValues: string[]) {
  return render(
    <TooltipProvider>
      <SetCookieEvidence beforeValues={beforeValues} afterValues={afterValues} />
    </TooltipProvider>,
  )
}

describe("SetCookieEvidence", () => {
  it("shows only changed cookies with their values in the comparison table", () => {
    renderEvidence(
      ["consent=yes; Path=/; Secure, anonymous=first; Domain=.example.test; Path=/; Max-Age=60; SameSite=Lax"],
      ["consent=yes; Path=/; Secure, anonymous=second; Domain=.example.test; Path=/; Max-Age=60; SameSite=Lax"],
    )

    expect(screen.getByRole("heading", { name: "Set-Cookie" })).toBeVisible()
    expect(screen.getByText("1 cookie changed")).toBeVisible()
    expect(screen.getByText("anonymous")).toBeVisible()
    expect(screen.getByText("Cookie")).toBeVisible()
    expect(screen.queryByText("consent")).not.toBeInTheDocument()
    expect(screen.getByText("Routine rotation")).toBeVisible()
    const cookie = screen.getByRole("article", { name: "anonymous" })
    const valueRow = within(cookie).getByText("Value").closest("tr")
    expect(valueRow).not.toBeNull()
    expect(within(valueRow!).getByText("first")).toBeVisible()
    expect(within(valueRow!).getByText("second").closest("td")).toHaveClass("text-orange-400")
    expect(within(valueRow!).getByText("first")).toHaveClass("truncate", "sm:whitespace-normal", "sm:break-all")
    expect(within(valueRow!).getByText("second")).toHaveClass("truncate", "sm:whitespace-normal", "sm:break-all")
    expect(within(cookie).getAllByRole("columnheader")).toHaveLength(3)
    expect(within(cookie).queryByRole("button", { name: /Copy .* cookie value/ })).not.toBeInTheDocument()
    expect(within(cookie).queryByRole("button", { name: /Reveal/ })).not.toBeInTheDocument()
  })

  it("highlights routine expiry rotation even though it does not alert", () => {
    renderEvidence(
      ["country=US; Path=/; Max-Age=31536000; Expires=Thu, 02 Sep 2027 20:45:13 GMT"],
      ["country=US; Path=/; Max-Age=31536000; Expires=Thu, 02 Sep 2027 21:01:46 GMT"],
    )

    const cookie = screen.getByRole("article", { name: "country" })
    expect(within(cookie).getByText("Routine rotation")).toBeVisible()
    const expiresRow = within(cookie).getByText("Expires").closest("tr")
    expect(expiresRow).not.toBeNull()
    const expiresCells = within(expiresRow!).getAllByRole("cell")
    expect(expiresCells[1]).toHaveTextContent("Thu, 02 Sep 2027 20:45:13 GMT")
    expect(expiresCells[2]).toHaveTextContent("Thu, 02 Sep 2027 21:01:46 GMT")
    expect(expiresCells[2]).toHaveClass("text-orange-400")
  })

  it("highlights changing expired Max-Age values without treating them as policy changes", () => {
    renderEvidence(
      ["ct0=unchanged; Path=/; Max-Age=-100"],
      ["ct0=unchanged; Path=/; Max-Age=-200"],
    )

    const cookie = screen.getByRole("article", { name: "ct0" })
    expect(within(cookie).getByText("Routine rotation")).toBeVisible()
    const maxAgeRow = within(cookie).getByText("Max-Age").closest("tr")
    expect(maxAgeRow).not.toBeNull()
    const maxAgeCells = within(maxAgeRow!).getAllByRole("cell")
    expect(maxAgeCells[1]).toHaveTextContent("-100 seconds")
    expect(maxAgeCells[2]).toHaveTextContent("-200 seconds")
    expect(maxAgeCells[2]).toHaveClass("text-orange-400")
  })

  it("compares cookie policy attributes individually", () => {
    renderEvidence(
      ["session=before; Domain=.example.test; Path=/; Secure; HttpOnly; SameSite=Lax"],
      ["session=after; Domain=.example.test; Path=/; Secure; HttpOnly; SameSite=Strict; Partitioned"],
    )

    const cookie = screen.getByRole("article", { name: "session" })
    expect(within(cookie).getByText("Modified")).toBeVisible()
    expect(within(cookie).getByText("Domain")).toBeVisible()
    expect(within(cookie).getByText("Path")).toBeVisible()
    expect(within(cookie).getByText("SameSite")).toBeVisible()
    expect(within(cookie).getByText("Secure")).toBeVisible()
    expect(within(cookie).getByText("HttpOnly")).toBeVisible()
    expect(within(cookie).getByText("Partitioned")).toBeVisible()
    expect(within(cookie).getByText("Lax")).toBeVisible()
    expect(within(cookie).getByText("Strict")).toBeVisible()
  })

  it("highlights the resulting cell when attributes are added or removed", () => {
    renderEvidence(
      ["session=before; Domain=.example.test; Path=/; SameSite=Lax"],
      ["session=after; Domain=.example.test; Path=/; Priority=High"],
    )

    const cookie = screen.getByRole("article", { name: "session" })
    const priorityRow = within(cookie).getByText("Priority").closest("tr")
    const sameSiteRow = within(cookie).getByText("SameSite").closest("tr")

    expect(priorityRow).not.toBeNull()
    expect(sameSiteRow).not.toBeNull()

    const priorityCells = within(priorityRow!).getAllByRole("cell")
    expect(priorityCells[0]).not.toHaveClass("text-orange-400")
    expect(priorityCells[1]).toHaveTextContent("Not set")
    expect(priorityCells[1]).toHaveClass("text-muted-foreground")
    expect(priorityCells[2]).toHaveTextContent("High")
    expect(priorityCells[2]).toHaveClass("text-orange-400")

    const sameSiteCells = within(sameSiteRow!).getAllByRole("cell")
    expect(sameSiteCells[0]).not.toHaveClass("text-orange-400")
    expect(sameSiteCells[1]).toHaveTextContent("Lax")
    expect(sameSiteCells[2]).toHaveTextContent("Not set")
    expect(sameSiteCells[2]).toHaveClass("text-orange-400")
  })

  it("uses the same value row for added and removed cookies", () => {
    renderEvidence(
      ["removed-cookie=old-token; Path=/"],
      ["added-cookie=new-token; Path=/"],
    )

    const addedCookie = screen.getByRole("article", { name: "added-cookie" })
    const addedValueRow = within(addedCookie).getByText("Value").closest("tr")
    expect(addedValueRow).not.toBeNull()
    const addedValueCells = within(addedValueRow!).getAllByRole("cell")
    expect(addedValueCells[1]).toHaveTextContent("Not present")
    expect(addedValueCells[2]).toHaveTextContent("new-token")
    expect(addedValueCells[2]).toHaveClass("text-orange-400")

    const removedCookie = screen.getByRole("article", { name: "removed-cookie" })
    const removedValueRow = within(removedCookie).getByText("Value").closest("tr")
    expect(removedValueRow).not.toBeNull()
    const removedValueCells = within(removedValueRow!).getAllByRole("cell")
    expect(removedValueCells[1]).toHaveTextContent("old-token")
    expect(removedValueCells[2]).toHaveTextContent("Not present")
    expect(removedValueCells[2]).toHaveClass("text-orange-400")
  })
})
