import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ChangeFilters } from "@/components/changes/change-filters";

const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigationMocks.replace }),
}));

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  navigationMocks.replace.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ChangeFilters", () => {
  it("applies a selected filter immediately without an apply button", () => {
    render(<ChangeFilters initialFilters={{ target: null, category: null }} />);

    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveTextContent("All categories");

    fireEvent.click(screen.getByRole("combobox", { name: "Category" }));
    fireEvent.click(screen.getByRole("option", { name: "Content" }));

    expect(navigationMocks.replace).toHaveBeenCalledWith("/changes?category=content", { scroll: false });
  });

  it("debounces target search before updating the page", () => {
    vi.useFakeTimers();
    render(<ChangeFilters initialFilters={{ target: null, category: null }} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search targets" }), {
      target: { value: "example.test" },
    });

    expect(navigationMocks.replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(275));

    expect(navigationMocks.replace).toHaveBeenCalledWith("/changes?target=example.test", { scroll: false });
  });
});
