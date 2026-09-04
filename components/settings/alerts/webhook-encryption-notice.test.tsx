import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { WebhookEncryptionNotice } from "@/components/settings/alerts/webhook-encryption-notice";

const toastMocks = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock("sonner", () => ({ toast: toastMocks }));

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");
});

beforeEach(() => {
  toastMocks.success.mockReset();
});

describe("WebhookEncryptionNotice", () => {
  it("explains the plaintext fallback and opens deployment instructions", () => {
    render(<WebhookEncryptionNotice />);

    expect(screen.getByText("Notification credentials are stored without application-layer encryption.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Enable encryption" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText("General setup")).toBeVisible();
    expect(screen.getByText("Railway template values")).toBeVisible();
    expect(screen.getByText(/Existing plaintext webhook and Resend credentials are encrypted the next time/)).toBeVisible();
  });

  it("copies the Railway CLI commands", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<WebhookEncryptionNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Enable encryption" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Railway commands" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("openssl rand -hex 32"));
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("worker-intel"));
      expect(toastMocks.success).toHaveBeenCalledWith("Railway commands copied");
    });
  });
});
