import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { AlertsPageClient } from "@/components/settings/alerts/alerts-page-client";
import type { AlertChannel, AlertPolicy, AlertSetupReadiness, EmailProviderSettings } from "@/lib/contracts/alerts";
import type { TargetResultItem } from "@/lib/contracts/targets";
import {
  DEMO_MOCK_ALERT_CHANNELS,
  DEMO_MOCK_ALERT_POLICIES,
  DEMO_MOCK_ALERT_READINESS,
  DEMO_MOCK_EMAIL_PROVIDER,
} from "@/lib/demo-mode-data";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeAll(async () => {
  await import("@testing-library/jest-dom/vitest");

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

const readiness: AlertSetupReadiness = {
  inAppChanges: { status: "ready", detail: "Ready", missingEnvironmentVariables: [] },
  email: { status: "needs_configuration", detail: "Configure Resend", missingEnvironmentVariables: [] },
  webhooks: { status: "ready", detail: "Ready", missingEnvironmentVariables: [] },
  deliveryWorker: { status: "unverified", detail: "Not verified", missingEnvironmentVariables: [] },
};

const channel: AlertChannel = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Operations webhook",
  channelType: "webhook",
  enabled: true,
  config: { hostname: "alerts.example.com", hasAuthorizationHeader: true, hasSigningSecret: true },
  lastTestStatus: "succeeded",
  lastTestedAt: "2026-08-24T12:00:00.000Z",
  lastTestErrorCategory: null,
  createdAt: "2026-08-24T12:00:00.000Z",
  updatedAt: "2026-08-24T12:00:00.000Z",
};

const slackChannel: AlertChannel = {
  id: "55555555-5555-4555-8555-555555555555",
  displayName: "Slack #security-alerts",
  channelType: "slack",
  enabled: false,
  config: {
    workspaceId: "T123",
    workspaceName: "Acme",
    channelId: "C123",
    channelName: "security-alerts",
    connectionSource: "oauth",
    configurationUrl: "https://acme.slack.com/services/B123",
  },
  lastTestStatus: "untested",
  lastTestedAt: null,
  lastTestErrorCategory: null,
  createdAt: "2026-08-24T12:00:00.000Z",
  updatedAt: "2026-08-24T12:00:00.000Z",
};

const policy: AlertPolicy = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Production changes",
  state: "enabled",
  coverage: "all_targets",
  conditions: { selectionMode: "all", changeTypes: [] },
  cooldownSeconds: 0,
  channelIds: [channel.id],
  targetIds: [],
  createdAt: "2026-08-24T12:00:00.000Z",
  updatedAt: "2026-08-24T12:00:00.000Z",
};

const emailProvider: EmailProviderSettings = {
  provider: "resend",
  domainName: "example.com",
  senderName: "Stackray Security",
  senderLocalPart: "alerts",
  fromAddress: "alerts@example.com",
  testRecipient: "admin@example.com",
  encrypted: true,
  oauthScope: "emails:send",
  lastTestStatus: "succeeded",
  lastTestedAt: "2026-08-24T12:00:00.000Z",
  lastTestErrorCategory: null,
  updatedAt: "2026-08-24T12:00:00.000Z",
};

const target: TargetResultItem = {
  canonicalTargetId: "33333333-3333-4333-8333-333333333333",
  normalizedTarget: "vercel.com",
  latestScanId: "44444444-4444-4444-8444-444444444444",
  title: "Vercel",
  technologies: ["Next.js"],
  lastScannedAt: "2026-08-24T12:00:00.000Z",
  faviconUrl: null,
  screenshotUrl: null,
};

function renderPage(
  provider: EmailProviderSettings | null = null,
  targetOptions: TargetResultItem[] = [],
  devPreviewEnabled = false,
  channels: AlertChannel[] = [channel],
  demoMode = false,
) {
  return render(
    <AlertsPageClient
      demoMode={demoMode}
      devPreviewEnabled={devPreviewEnabled}
      initialReadiness={readiness}
      initialEmailProvider={provider}
      adminEmail="admin@example.com"
      initialResendSetupId={null}
      initialResendError={null}
      initialResendDisconnected={false}
      initialChannels={channels}
      initialPolicies={[policy]}
      initialTargetOptions={targetOptions}
    />,
  );
}

function getPolicyFormScrollContainer() {
  const scrollContainer = screen.getByRole("dialog").querySelector<HTMLElement>("[data-slot='policy-form-scroll']");
  expect(scrollContainer).not.toBeNull();
  return scrollContainer!;
}

describe("AlertsPageClient", () => {
  it("shows representative demo alerts and gates mutations behind the Railway prompt", async () => {
    const track = vi.fn();
    window.umami = { track };

    render(
      <AlertsPageClient
        demoMode
        devPreviewEnabled={false}
        initialReadiness={DEMO_MOCK_ALERT_READINESS}
        initialEmailProvider={DEMO_MOCK_EMAIL_PROVIDER}
        adminEmail="demo@stackray.local"
        initialResendSetupId={null}
        initialResendError={null}
        initialResendDisconnected={false}
        initialChannels={DEMO_MOCK_ALERT_CHANNELS}
        initialPolicies={DEMO_MOCK_ALERT_POLICIES}
        initialTargetOptions={[]}
      />,
    );

    expect(screen.getAllByText("Security team").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Website alerts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Availability and TLS").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Add channel" }));
    expect(screen.getByRole("heading", { name: "Alerting needs your own deployment" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Add notification channel" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Launch on Railway/i })).toHaveAttribute(
      "href",
      "https://railway.com/deploy/stackray",
    );
    await waitFor(() => expect(track).toHaveBeenCalledWith(
      "demo_deployment_prompt_opened",
      { source: "alerts_add_channel" },
    ));
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Alerting needs your own deployment" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));
    expect(screen.getByRole("heading", { name: "Alerting needs your own deployment" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Create alert policy" })).not.toBeInTheDocument();
    await waitFor(() => expect(track).toHaveBeenCalledWith(
      "demo_deployment_prompt_opened",
      { source: "alerts_create_policy" },
    ));

    delete window.umami;
  });

  it("renders the unified alert workspace", () => {
    renderPage();

    expect(screen.queryByText("Alert system")).not.toBeInTheDocument();
    expect(screen.getByText("Email via Resend")).toBeVisible();
    expect(screen.getByText("Slack")).toBeVisible();
    expect(screen.queryByText("Webhooks")).not.toBeInTheDocument();
    expect(screen.queryByText("Delivery worker")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect Resend" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Set up" })).toBeVisible();
    const policiesTable = screen.getByRole("table", { name: "Alert policies" });
    const channelsTable = screen.getByRole("table", { name: "Notification channels" });
    expect(policiesTable).toBeVisible();
    expect(screen.getByText("Notification channels")).toBeVisible();
    expect(screen.queryByText("Email delivery")).not.toBeInTheDocument();
    expect(within(channelsTable).getByText("Operations webhook")).toBeVisible();
    expect(within(channelsTable).getByText("Test passed · Aug 24")).toBeVisible();
    expect(screen.getByText("Alert policies")).toBeVisible();
    expect(channelsTable).toBeVisible();
    expect(within(policiesTable).getByText("Production changes")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const channelsCard = screen.getByRole("region", { name: "Notification channels" }).closest("[data-slot='card']");
    const policiesCard = screen.getByRole("region", { name: "Alert policies" }).closest("[data-slot='card']");
    expect(channelsCard).not.toBeNull();
    expect(policiesCard).not.toBeNull();
    expect(channelsCard).not.toBe(policiesCard);

    const sectionHeadings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(sectionHeadings).toEqual(["Notification channels", "Alert policies"]);
  });

  it("shows Slack setup state until a Slack destination is connected", () => {
    const { unmount } = renderPage();
    const slackSetupStatus = screen.getByTitle("Connect Slack or add an incoming webhook to create a Slack notification channel.");
    expect(within(slackSetupStatus).getByText("Setup needed")).toBeVisible();
    expect(within(slackSetupStatus).getByRole("button", { name: "Set up" })).toBeVisible();
    unmount();

    renderPage(null, [], false, [channel, slackChannel]);
    const slackConnectedStatus = screen.getByTitle("Slack is connected through at least one notification channel.");
    expect(within(slackConnectedStatus).getByText("Connected")).toBeVisible();
    expect(within(slackConnectedStatus).queryByRole("button")).not.toBeInTheDocument();
  });

  it("opens Slack setup from the provider status", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Set up" }));

    expect(screen.getByRole("heading", { name: "Add notification channel" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Slack" })).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("button", { name: "Connect Slack" })).toBeVisible();
  });

  it("only exposes the alert preview tool when the development actor flag is enabled", async () => {
    const { unmount } = renderPage();
    expect(screen.queryByRole("button", { name: "Preview alert" })).not.toBeInTheDocument();
    unmount();

    renderPage(null, [], true);
    expect(await screen.findByRole("button", { name: "Preview alert" })).toBeVisible();
  });

  it("explains Resend before connecting email delivery", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Connect Resend" }));

    expect(screen.getByRole("heading", { name: "Connect Resend" })).toBeVisible();
    expect(screen.getByText(/Resend delivers Stackray email alerts/)).toBeVisible();
    expect(screen.getByText("Sending access")).toBeVisible();
  });

  it("opens channel and policy forms on demand", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Add channel" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Add notification channel" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Email" })).toHaveAttribute("data-state", "on");
    fireEvent.click(screen.getByRole("radio", { name: "Slack" }));
    expect(screen.getByRole("radio", { name: "Slack" })).toHaveAttribute("data-state", "on");
    await waitFor(() => expect(screen.getByRole("button", { name: "Connect Slack" })).toBeVisible());
    expect(screen.getByRole("button", { name: "Connect Slack" }).closest("[data-slot='dialog-footer']")).not.toBeNull();
    expect(screen.queryByLabelText("Slack channel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use an incoming webhook instead" }));
    await waitFor(() => expect(screen.getByLabelText("Slack channel")).toBeVisible());
    expect(screen.getByLabelText("Incoming webhook URL")).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: "Webhook" }));
    expect(screen.getByRole("radio", { name: "Webhook" })).toHaveAttribute("data-state", "on");
    await waitFor(() => expect(screen.getByLabelText("HTTPS endpoint")).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Create alert policy" })).toBeVisible();
  });

  it("presents policy setup as clear target, change, and delivery choices", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));

    expect(screen.getByRole("heading", { name: "Targets" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Changes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Delivery" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /All targets/ })).toHaveAttribute("data-state", "on");
    expect(screen.queryByRole("radio", { name: /Meaningful changes/ })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Every change/ })).toHaveAttribute("data-state", "on");

    fireEvent.click(screen.getByRole("radio", { name: /Choose change types/ }));
    const changeTypeChoice = screen.getByRole("radio", { name: /Choose change types/ }).parentElement;
    expect(changeTypeChoice).not.toBeNull();
    expect(within(changeTypeChoice!).getByText("0 types selected")).toBeVisible();
    expect(within(changeTypeChoice!).getByRole("button", { name: "Select types" })).toBeVisible();
    expect(screen.queryByText("HTTP status changed")).not.toBeInTheDocument();

    getPolicyFormScrollContainer().scrollTop = 320;
    fireEvent.click(screen.getByRole("button", { name: "Select types" }));
    expect(screen.getByText("HTTP status changed")).toBeVisible();
    expect(screen.getByText("Detected technologies changed")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enable policy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done selecting · 0" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to policy" }).parentElement).not.toHaveClass("sticky");
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "HTTP status changed" }));
    fireEvent.click(screen.getByRole("button", { name: "Done selecting · 1" }));
    const editedChangeTypeChoice = screen.getByRole("radio", { name: /Choose change types/ }).parentElement;
    expect(editedChangeTypeChoice).not.toBeNull();
    expect(within(editedChangeTypeChoice!).getByText("1 type selected")).toBeVisible();
    expect(within(editedChangeTypeChoice!).getByRole("button", { name: "Edit types" })).toBeVisible();
    expect(getPolicyFormScrollContainer()).toHaveProperty("scrollTop", 320);
    expect(screen.getByRole("button", { name: "Enable policy" })).toBeVisible();
    expect(screen.queryByText("Recommended changes")).not.toBeInTheDocument();
  });

  it("loads target choices only after an admin searches in the focused picker", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      items: [target],
      nextCursor: null,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    renderPage(null, [target]);

    fireEvent.click(screen.getByRole("button", { name: "Create policy" }));
    fireEvent.click(screen.getByRole("radio", { name: /Selected targets/ }));
    const selectedTargetChoice = screen.getByRole("radio", { name: /Selected targets/ }).parentElement;
    expect(selectedTargetChoice).not.toBeNull();
    expect(within(selectedTargetChoice!).getByText("0 targets selected")).toBeVisible();
    expect(within(selectedTargetChoice!).getByRole("button", { name: "Select targets" })).toBeVisible();
    expect(screen.queryByLabelText("Search alert targets")).not.toBeInTheDocument();
    expect(screen.queryByText("vercel.com")).not.toBeInTheDocument();

    getPolicyFormScrollContainer().scrollTop = 180;
    fireEvent.click(screen.getByRole("button", { name: "Select targets" }));
    expect(screen.getByLabelText("Search alert targets")).toBeVisible();
    expect(screen.getByLabelText("Search alert targets").closest("form")).toHaveClass("min-h-[56svh]");
    expect(screen.queryByText("Search results")).not.toBeInTheDocument();
    expect(screen.queryByText("Search for a target")).not.toBeInTheDocument();
    expect(screen.queryByText("vercel.com")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search alert targets"), { target: { value: "vercel" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/targets/results?limit=20&q=vercel",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(await screen.findByText("vercel.com")).toBeVisible();
    expect(screen.getByText("Search results")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /vercel.com/ }));
    expect(screen.getByText("Selected targets")).toBeVisible();
    expect(screen.queryByText("Search results")).not.toBeInTheDocument();
    expect(screen.queryByText("All matching targets are selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable policy" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to policy" }).parentElement).not.toHaveClass("sticky");
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done selecting · 1" }));
    const editedTargetChoice = screen.getByRole("radio", { name: /Selected targets/ }).parentElement;
    expect(editedTargetChoice).not.toBeNull();
    expect(within(editedTargetChoice!).getByText("1 target selected")).toBeVisible();
    expect(within(editedTargetChoice!).getByRole("button", { name: "Edit targets" })).toBeVisible();
    expect(getPolicyFormScrollContainer()).toHaveProperty("scrollTop", 180);
    expect(screen.getByRole("button", { name: "Enable policy" })).toBeVisible();

    fetchMock.mockRestore();
  });

  it("lets an admin edit the configured sender and domain", () => {
    renderPage(emailProvider);

    expect(screen.queryByText(emailProvider.fromAddress)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(screen.getByRole("heading", { name: "Email delivery settings" })).toBeVisible();
    expect(screen.getByText("Connected to Resend")).toBeVisible();
    expect(screen.getByLabelText("Sender name")).toHaveValue("Stackray Security");
    expect(screen.getByLabelText("From address")).toHaveValue("alerts");
    expect(screen.getByLabelText("Sending domain")).toHaveValue("example.com");
    expect(screen.getByRole("button", { name: "Reconnect Resend" })).toBeVisible();
  });

  it("rejects a sending domain without a dot before saving", () => {
    renderPage(emailProvider);

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.change(screen.getByLabelText("Sending domain"), { target: { value: "localhost" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(screen.getByText("Enter a valid domain, such as example.com.")).toBeVisible();
  });

  it("opens prefilled edit forms from channel and policy action menus", () => {
    renderPage();

    const channelsTable = screen.getByRole("table", { name: "Notification channels" });
    fireEvent.click(within(channelsTable).getByRole("button", { name: "Actions for Operations webhook" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit notification channel" })).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Operations webhook");
    expect(screen.getByRole("radio", { name: "Webhook" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const policiesTable = screen.getByRole("table", { name: "Alert policies" });
    fireEvent.click(within(policiesTable).getByRole("button", { name: "Actions for Production changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: "Edit alert policy" })).toBeVisible();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();

    fireEvent.click(screen.getByRole("radio", { name: /Choose change types/ }));
    fireEvent.click(screen.getByRole("button", { name: "Select types" }));
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enable policy" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "HTTP status changed" }));
    fireEvent.click(screen.getByRole("button", { name: "Done selecting · 1" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enable policy" })).not.toBeInTheDocument();
  });

  it("requires reconnecting Slack to change an OAuth destination", () => {
    renderPage(null, [], false, [channel, slackChannel]);

    const channelsTable = screen.getByRole("table", { name: "Notification channels" });
    fireEvent.click(within(channelsTable).getByRole("button", { name: "Actions for Slack #security-alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Slack channel")).toHaveValue("security-alerts");
    expect(screen.getByLabelText("Slack channel")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Workspace name (optional)")).toHaveValue("Acme");
    expect(screen.getByLabelText("Workspace name (optional)")).toHaveAttribute("readonly");
    expect(screen.getByText("Reconnect Slack to choose another channel.")).toBeVisible();
    expect(screen.queryByLabelText(/Incoming webhook URL/)).not.toBeInTheDocument();
  });
});
