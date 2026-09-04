import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { ChangeTransition } from "@/components/changes/change-transition";

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

describe("ChangeTransition", () => {
  it("renders the shared standalone transition arrow", () => {
    const { container } = render(
      <ChangeTransition
        ariaLabel="Example transition"
        before={<span>Baseline evidence</span>}
        after={<span>Current evidence</span>}
      />,
    );

    expect(screen.getByRole("group", { name: "Example transition" })).toBeVisible();
    expect(screen.getByText("Baseline evidence")).toBeVisible();
    expect(screen.getByText("Current evidence")).toBeVisible();

    const connector = container.querySelector("[data-slot='change-transition-connector']");
    expect(connector).toHaveAttribute("aria-hidden", "true");
    expect(connector).toHaveClass("justify-self-center", "sm:justify-self-auto");
    expect(connector?.querySelectorAll("svg")).toHaveLength(1);
  });
});
