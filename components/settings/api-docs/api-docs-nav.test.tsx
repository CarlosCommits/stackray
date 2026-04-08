import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiDocsNav, type TocItem } from "@/components/settings/api-docs/api-docs-nav"
import { buildApiDocsContent } from "@/lib/api-docs/content"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

const mockItems: TocItem[] = [
  { id: "api-docs", label: "API docs" },
  { id: "quick-start", label: "Quick start" },
  { id: "authentication", label: "Authentication" },
  { id: "submit-scan", label: "Submit a scan" },
]

const builtItems = buildApiDocsContent(true).tocItems

function createScrollToSetter(setTop: (top: number) => void) {
  return (options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === "number") {
      setTop(y ?? 0)
      return
    }

    setTop(options?.top ?? 0)
  }
}

describe("ApiDocsNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    vi.useRealTimers()
  })

  it("renders navigation with accessible label", () => {
    render(<ApiDocsNav items={mockItems} />)
    
    expect(screen.getByLabelText("API documentation navigation")).toBeTruthy()
  })

  it("renders all TOC items as links", () => {
    render(<ApiDocsNav items={mockItems} />)
    
    mockItems.forEach(item => {
      const link = screen.getByRole("link", { name: item.label })
      expect(link).toBeTruthy()
    })
  })

  it("renders section heading", () => {
    render(<ApiDocsNav items={mockItems} />)
    
    expect(screen.getByText("On this page")).toBeTruthy()
  })

  it("renders nothing when items array is empty", () => {
    const { container } = render(<ApiDocsNav items={[]} />)
    
    expect(container.firstChild).toBeNull()
  })

  it("uses the built intro TOC item as the default active anchor", () => {
    render(<ApiDocsNav items={builtItems} />)

    expect(builtItems[0]).toEqual({ id: "api-docs", label: "API docs" })

    const firstLink = screen.getByRole("link", { name: "API docs" })
    expect(firstLink.getAttribute("href")).toBe("#api-docs")
    expect(firstLink.classList.contains("text-[var(--accent)]")).toBe(true)
    expect(firstLink.classList.contains("bg-[var(--accent)]/10")).toBe(true)
    expect(firstLink.getAttribute("aria-current")).toBe("location")
  })

  it("updates the active item when the scroll container scrolls to a later section", async () => {
    const container = document.createElement("div")
    container.setAttribute("data-app-scroll-container", "true")
    let scrollTop = 0

    Object.defineProperty(container, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
      configurable: true,
    })
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true })
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true })
    Object.defineProperty(container, "scrollTo", {
      value: createScrollToSetter((top) => {
        scrollTop = top
      }),
      configurable: true,
    })
    container.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 600,
      width: 0,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    document.body.appendChild(container)

    const sectionPositions: Record<string, number> = {
      "api-docs": 0,
      "quick-start": 40,
      authentication: 400,
      "submit-scan": 800,
    }

    Object.entries(sectionPositions).forEach(([id, top]) => {
      const section = document.createElement("section")
      section.id = id
      section.getBoundingClientRect = () => ({
        top: top - scrollTop,
        left: 0,
        right: 0,
        bottom: top - scrollTop + 200,
        width: 0,
        height: 200,
        x: 0,
        y: top - scrollTop,
        toJSON: () => ({}),
      })
      document.body.appendChild(section)
    })

    render(<ApiDocsNav items={mockItems} />)

    scrollTop = 780
    fireEvent.scroll(container)

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Submit a scan" }).getAttribute("aria-current")).toBe("location")
    })
  })

  it("falls back to the nearest scrollable ancestor when the data attribute is missing", async () => {
    const originalGetComputedStyle = window.getComputedStyle
    const scrollHost = document.createElement("div")
    let scrollTop = 0

    Object.defineProperty(scrollHost, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
      configurable: true,
    })
    Object.defineProperty(scrollHost, "clientHeight", { value: 600, configurable: true })
    let scrollHeight = 600
    Object.defineProperty(scrollHost, "scrollHeight", {
      get: () => scrollHeight,
      configurable: true,
    })
    Object.defineProperty(scrollHost, "scrollTo", {
      value: createScrollToSetter((top) => {
        scrollTop = top
      }),
      configurable: true,
    })
    scrollHost.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 600,
      width: 0,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    document.body.appendChild(scrollHost)

    const sectionPositions: Record<string, number> = {
      "api-docs": 0,
      "quick-start": 40,
      authentication: 400,
      "submit-scan": 800,
    }

    Object.entries(sectionPositions).forEach(([id, top]) => {
      const section = document.createElement("section")
      section.id = id
      section.getBoundingClientRect = () => ({
        top: top - scrollTop,
        left: 0,
        right: 0,
        bottom: top - scrollTop + 200,
        width: 0,
        height: 200,
        x: 0,
        y: top - scrollTop,
        toJSON: () => ({}),
      })
      document.body.appendChild(section)
    })

    vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
      if (element === scrollHost) {
        return {
          ...originalGetComputedStyle(document.body),
          overflowY: "auto",
          overflow: "auto",
        } as CSSStyleDeclaration
      }

      return originalGetComputedStyle(element)
    })

    render(<ApiDocsNav items={mockItems} />, { container: scrollHost })

    scrollHeight = 2000
    scrollTop = 780
    fireEvent.scroll(scrollHost)

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Submit a scan" }).getAttribute("aria-current")).toBe("location")
    })
  })

  it("keeps the clicked item active during programmatic scroll", async () => {
    vi.useFakeTimers()

    const container = document.createElement("div")
    container.setAttribute("data-app-scroll-container", "true")
    let scrollTop = 0

    Object.defineProperty(container, "scrollTop", {
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value
      },
      configurable: true,
    })
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true })
    Object.defineProperty(container, "scrollHeight", { value: 2000, configurable: true })
    Object.defineProperty(container, "scrollTo", {
      value: vi.fn(),
      configurable: true,
    })
    container.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      right: 0,
      bottom: 600,
      width: 0,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    document.body.appendChild(container)

    const sectionPositions: Record<string, number> = {
      "api-docs": 0,
      "quick-start": 40,
      authentication: 400,
      "submit-scan": 800,
    }

    Object.entries(sectionPositions).forEach(([id, top]) => {
      const section = document.createElement("section")
      section.id = id
      section.getBoundingClientRect = () => ({
        top: top - scrollTop,
        left: 0,
        right: 0,
        bottom: top - scrollTop + 200,
        width: 0,
        height: 200,
        x: 0,
        y: top - scrollTop,
        toJSON: () => ({}),
      })
      document.body.appendChild(section)
    })

    render(<ApiDocsNav items={mockItems} />)

    await act(async () => {
      fireEvent.click(screen.getByRole("link", { name: "Submit a scan" }))
    })

    expect(screen.getByRole("link", { name: "Submit a scan" }).getAttribute("aria-current")).toBe("location")

    scrollTop = 500
    await act(async () => {
      fireEvent.scroll(container)
    })

    expect(screen.getByRole("link", { name: "Submit a scan" }).getAttribute("aria-current")).toBe("location")

    await act(async () => {
      vi.advanceTimersByTime(181)
    })

    expect(screen.getByRole("link", { name: "Authentication" }).getAttribute("aria-current")).toBe("location")

  })
})
