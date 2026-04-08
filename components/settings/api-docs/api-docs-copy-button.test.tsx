import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiDocsCopyButton } from "./api-docs-copy-button"

const mockMarkdownContent = "# Markdown content"
const mockPlainTextContent = "Plain text content"

describe("ApiDocsCopyButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("renders button with Copy icon and text", () => {
    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    expect(screen.getByRole("button", { name: /copy docs/i })).toBeTruthy()
  })

  it("opens popover with two options when clicked", async () => {
    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    await waitFor(() => {
      expect(screen.getByText("Copy as Markdown")).toBeTruthy()
      expect(screen.getByText("Copy as Text")).toBeTruthy()
    })
  })

  it("copies markdown content when Copy as Markdown is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    const markdownOption = screen.getByText("Copy as Markdown")
    await act(async () => {
      fireEvent.click(markdownOption)
    })

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(mockMarkdownContent)
    })
  })

  it("copies plain text content when Copy as Text is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    const textOption = screen.getByText("Copy as Text")
    await act(async () => {
      fireEvent.click(textOption)
    })

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(mockPlainTextContent)
    })
  })

  it("shows success feedback after copying", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    const markdownOption = screen.getByText("Copy as Markdown")
    await act(async () => {
      fireEvent.click(markdownOption)
    })

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy()
    })
  })

  it("resets button text after 2 seconds", async () => {
    vi.useFakeTimers()

    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    const markdownOption = screen.getByText("Copy as Markdown")
    await act(async () => {
      fireEvent.click(markdownOption)
    })

    expect(screen.getByRole("button", { name: /copied/i })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByRole("button", { name: /copy docs/i })).toBeTruthy()

    vi.useRealTimers()
  })

  it("closes popover after selecting an option", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <ApiDocsCopyButton
        markdownContent={mockMarkdownContent}
        plainTextContent={mockPlainTextContent}
      />
    )

    const button = screen.getByRole("button", { name: /copy docs/i })
    await act(async () => {
      fireEvent.click(button)
    })

    const markdownOption = screen.getByText("Copy as Markdown")
    await act(async () => {
      fireEvent.click(markdownOption)
    })

    await waitFor(() => {
      expect(screen.queryByText("Copy as Markdown")).toBeNull()
      expect(screen.queryByText("Copy as Text")).toBeNull()
    })
  })
})
