import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { ChangeTargetIcon } from "@/components/changes/change-target-icon";

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

describe("ChangeTargetIcon", () => {
  it("renders a valid favicon URL", () => {
    const { container } = render(<ChangeTargetIcon faviconUrl="https://example.test/favicon.ico" />);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.test/favicon.ico",
    );
  });

  it("falls back when the favicon source is invalid or fails to load", () => {
    const { container, rerender } = render(<ChangeTargetIcon faviconUrl="favicon-hash" />);

    expect(container.querySelector("img")).not.toBeInTheDocument();

    rerender(<ChangeTargetIcon faviconUrl="/api/v1/scans/scan-1/results/result-1/favicon" />);
    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});
