import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { HeaderValueCell } from "@/components/changes/header-value-cell"
import { TooltipProvider } from "@/components/ui/tooltip"

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest")
})

describe("HeaderValueCell", () => {
  it("shows ordinary header values without a reveal step", () => {
    render(
      <TooltipProvider>
        <HeaderValueCell
          values={["default-src 'self'"]}
          label="after content-security-policy"
          current
          missingLabel="Not present"
        />
      </TooltipProvider>,
    )

    expect(screen.getByText("default-src 'self'")).toBeVisible()
    expect(screen.queryByText("Stored value hidden")).not.toBeInTheDocument()
  })

  it("highlights a missing resulting value but not unavailable evidence", () => {
    const { rerender } = render(
      <TooltipProvider>
        <HeaderValueCell
          values={null}
          label="after content-disposition"
          current
          missingLabel="Not present"
        />
      </TooltipProvider>,
    )

    expect(screen.getByText("Not present")).toHaveClass("text-orange-400")

    rerender(
      <TooltipProvider>
        <HeaderValueCell
          values={null}
          label="after content-disposition"
          current
          missingLabel="Value unavailable"
        />
      </TooltipProvider>,
    )

    expect(screen.getByText("Value unavailable")).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Value unavailable")).not.toHaveClass("text-orange-400")
  })

  it("copies through the selection fallback when the Clipboard API is unavailable", async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard")
    const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, "execCommand")
    const execCommand = vi.fn().mockImplementation(() => {
      const control = document.activeElement as HTMLInputElement
      expect(control).toHaveAttribute("data-clipboard-fallback")
      expect(control.selectionStart).toBe(0)
      expect(control.selectionEnd).toBe(control.value.length)
      return true
    })

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })

    try {
      render(
        <TooltipProvider>
          <HeaderValueCell
            values={["stored-secret"]}
            label="current session"
            current
            missingLabel="Not present"
          />
        </TooltipProvider>,
      )

      fireEvent.click(screen.getByRole("button", { name: "Copy current session header value" }))

      await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"))
      expect(document.querySelector("[data-clipboard-fallback]")).not.toBeInTheDocument()
    } finally {
      if (clipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor)
      } else {
        Reflect.deleteProperty(navigator, "clipboard")
      }
      if (execCommandDescriptor) {
        Object.defineProperty(document, "execCommand", execCommandDescriptor)
      } else {
        Reflect.deleteProperty(document, "execCommand")
      }
    }
  })
})
