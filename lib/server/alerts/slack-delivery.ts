import { getChangeTypeDefinition } from "../../changes/change-types.ts";
import type { AlertWebhookPayload } from "./webhook-payload.ts";
import { parseWebhookRetryAfter } from "./webhook-delivery.ts";

const SLACK_WEBHOOK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 4_096;

type SlackTextObject = {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
};

type SlackBlock =
  | { type: "header"; text: SlackTextObject }
  | { type: "section"; text: SlackTextObject }
  | { type: "context"; elements: SlackTextObject[] }
  | { type: "divider" }
  | {
      type: "actions";
      elements: Array<{
        type: "button";
        action_id: string;
        text: SlackTextObject;
        url: string;
        style: "primary";
      }>;
    };

export type SlackMessage = {
  text: string;
  blocks: SlackBlock[];
};

export type SlackDeliveryFailureCategory =
  | "invalid_destination"
  | "timeout"
  | "network_error"
  | "rate_limited"
  | "channel_archived"
  | "webhook_revoked"
  | "request_blocked"
  | "client_error"
  | "server_error";

export type SlackDeliveryResult =
  | { ok: true; httpStatus: number }
  | {
      ok: false;
      category: SlackDeliveryFailureCategory;
      retryable: boolean;
      safeMessage: string;
      httpStatus?: number;
      retryAfterMs?: number;
    };

export interface DeliverSlackAlertOptions {
  webhookUrl: string;
  payload: AlertWebhookPayload;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function truncate(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeSlackMrkdwn(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function validateSlackWebhookUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid Slack incoming webhook URL.");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  if (
    url.protocol !== "https:"
    || !SLACK_WEBHOOK_HOSTS.has(url.hostname.toLowerCase())
    || url.port
    || url.username
    || url.password
    || url.search
    || url.hash
    || pathParts.length !== 4
    || pathParts[0] !== "services"
    || pathParts.slice(1).some((part) => part.length === 0)
  ) {
    throw new Error("Use a Slack incoming webhook URL from hooks.slack.com.");
  }

  return url;
}

export function buildSlackAlertMessage(payload: AlertWebhookPayload): SlackMessage {
  const targetLabel = truncate(payload.target.label || payload.target.url, 110);
  const changeCount = payload.summary.totalChanges;
  const fallbackText = `Stackray: ${changeCount} ${changeCount === 1 ? "change" : "changes"} detected for ${targetLabel}`;
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: truncate(payload.summary.headline || fallbackText, 150), emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Target:* <${payload.target.url}|${escapeSlackMrkdwn(targetLabel)}>\n${changeCount} ${changeCount === 1 ? "website change" : "website changes"} detected`,
      },
    },
    { type: "divider" },
  ];

  for (const change of payload.changes) {
    const label = getChangeTypeDefinition(change.type)?.label ?? change.summary;
    const detail = change.preview ?? change.summary;
    const endpoint = change.endpoint ? `\n_${escapeSlackMrkdwn(change.endpoint)}_` : "";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncate(`*${escapeSlackMrkdwn(label)}*\n${escapeSlackMrkdwn(detail)}${endpoint}`, 3_000),
      },
    });
  }

  if (payload.summary.includedChanges < payload.summary.totalChanges) {
    blocks.push({
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `Showing ${payload.summary.includedChanges} of ${payload.summary.totalChanges} changes.`,
      }],
    });
  }

  blocks.push({
    type: "actions",
    elements: [{
      type: "button",
      action_id: "review_stackray_changes",
      text: { type: "plain_text", text: "Review changes", emoji: true },
      url: payload.comparison.url,
      style: "primary",
    }],
  });

  return { text: fallbackText, blocks };
}

function classifySlackFailure(status: number, responseBody: string) {
  const error = responseBody.trim().toLowerCase();
  if (status === 429) {
    return { category: "rate_limited" as const, retryable: true, message: "Slack rate-limited the notification." };
  }
  if (status === 408 || status >= 500) {
    return { category: "server_error" as const, retryable: true, message: "Slack is temporarily unable to accept the notification." };
  }
  if (error === "channel_is_archived") {
    return { category: "channel_archived" as const, retryable: false, message: "The selected Slack channel is archived." };
  }
  if (["invalid_token", "no_active_hooks", "no_service", "no_service_id", "no_team"].includes(error) || status === 404 || status === 410) {
    return { category: "webhook_revoked" as const, retryable: false, message: "The Slack webhook is no longer active. Reconnect this channel." };
  }
  if (["action_prohibited", "posting_to_general_channel_denied", "team_disabled"].includes(error)) {
    return { category: "request_blocked" as const, retryable: false, message: "Slack workspace policy blocked this notification." };
  }
  return { category: "client_error" as const, retryable: false, message: "Slack rejected the notification." };
}

async function readBoundedResponse(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let output = "";
  let bytes = 0;

  try {
    while (bytes < MAX_RESPONSE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = MAX_RESPONSE_BYTES - bytes;
      const chunk = value.subarray(0, remaining);
      bytes += chunk.byteLength;
      output += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength) {
        await reader.cancel();
        break;
      }
    }
    output += decoder.decode();
    return output;
  } finally {
    reader.releaseLock();
  }
}

export async function deliverSlackAlert(options: DeliverSlackAlertOptions): Promise<SlackDeliveryResult> {
  let webhookUrl: URL;
  try {
    webhookUrl = validateSlackWebhookUrl(options.webhookUrl);
  } catch {
    return {
      ok: false,
      category: "invalid_destination",
      retryable: false,
      safeMessage: "The Slack incoming webhook URL is invalid.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await (options.fetchImpl ?? fetch)(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(buildSlackAlertMessage(options.payload)),
      redirect: "manual",
      signal: controller.signal,
    });
    const responseBody = await readBoundedResponse(response);
    if (response.ok) {
      return { ok: true, httpStatus: response.status };
    }

    const failure = classifySlackFailure(response.status, responseBody);
    return {
      ok: false,
      category: failure.category,
      retryable: failure.retryable,
      safeMessage: failure.message,
      httpStatus: response.status,
      ...(response.status === 429
        ? { retryAfterMs: parseWebhookRetryAfter(response.headers.get("retry-after"), options.now?.() ?? Date.now()) }
        : {}),
    };
  } catch {
    if (controller.signal.aborted) {
      return { ok: false, category: "timeout", retryable: true, safeMessage: "The Slack request timed out." };
    }
    return { ok: false, category: "network_error", retryable: true, safeMessage: "Slack could not be reached." };
  } finally {
    clearTimeout(timeout);
  }
}
