import { lookup } from "node:dns/promises";
import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

import {
  type AlertWebhookPayload,
  serializeAlertWebhookPayload,
  signAlertWebhookPayload,
} from "./webhook-payload.ts";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4_096;
const MAX_RETRY_AFTER_MS = 60 * 60 * 1_000;

const blockedAddresses = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
] as const) {
  blockedAddresses.addSubnet(address, prefix, "ipv4");
}

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const) {
  blockedAddresses.addSubnet(address, prefix, "ipv6");
}

export type WebhookDeliveryFailureCategory =
  | "invalid_destination"
  | "blocked_destination"
  | "dns_failure"
  | "timeout"
  | "network_error"
  | "redirect"
  | "rate_limited"
  | "request_timeout"
  | "client_error"
  | "server_error";

export type WebhookDeliveryResult =
  | {
      ok: true;
      httpStatus: number;
      responseBytes: number;
      responseTruncated: boolean;
    }
  | {
      ok: false;
      category: WebhookDeliveryFailureCategory;
      retryable: boolean;
      httpStatus?: number;
      retryAfterMs?: number;
      safeMessage: string;
    };

interface ResolvedAddress {
  address: string;
  family: number;
}

interface ValidatedDestination {
  url: URL;
  addresses: ResolvedAddress[];
}

export interface DeliverAlertWebhookOptions {
  endpoint: string;
  eventId: string;
  payload: AlertWebhookPayload;
  authorization?: string;
  signingSecret?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowHttpLocalhost?: boolean;
  fetchImpl?: typeof fetch;
  resolveAddresses?: (hostname: string) => Promise<ResolvedAddress[]>;
  now?: () => number;
}

class WebhookDestinationError extends Error {
  readonly category: "invalid_destination" | "blocked_destination" | "dns_failure";

  constructor(category: WebhookDestinationError["category"], message: string) {
    super(message);
    this.name = "WebhookDestinationError";
    this.category = category;
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function isBlockedAddress(address: string, family: number) {
  if (family === 4 || isIP(address) === 4) {
    return blockedAddresses.check(address, "ipv4");
  }

  if (family === 6 || isIP(address) === 6) {
    const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
    return mappedIpv4
      ? blockedAddresses.check(mappedIpv4, "ipv4")
      : blockedAddresses.check(address, "ipv6");
  }

  return true;
}

async function defaultResolveAddresses(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

async function resolveAlertWebhookDestination(
  endpoint: string,
  options: Pick<DeliverAlertWebhookOptions, "allowHttpLocalhost" | "resolveAddresses"> = {},
): Promise<ValidatedDestination> {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new WebhookDestinationError("invalid_destination", "The webhook URL is invalid.");
  }

  if (url.username || url.password || url.hash) {
    throw new WebhookDestinationError(
      "invalid_destination",
      "Webhook URLs cannot contain credentials or fragments.",
    );
  }

  const explicitLocalDevelopment =
    options.allowHttpLocalhost === true && url.protocol === "http:" && isLocalHostname(url.hostname);

  if (url.protocol !== "https:" && !explicitLocalDevelopment) {
    throw new WebhookDestinationError("invalid_destination", "Webhook URLs must use HTTPS.");
  }

  if (explicitLocalDevelopment) {
    return { url, addresses: [] };
  }
  if (isLocalHostname(url.hostname)) {
    throw new WebhookDestinationError("blocked_destination", "The webhook destination is not publicly routable.");
  }

  const literalFamily = isIP(url.hostname);
  let addresses: ResolvedAddress[];
  try {
    addresses = literalFamily
      ? [{ address: url.hostname, family: literalFamily }]
      : await (options.resolveAddresses ?? defaultResolveAddresses)(url.hostname);
  } catch {
    throw new WebhookDestinationError("dns_failure", "The webhook destination could not be resolved.");
  }

  if (addresses.length === 0) {
    throw new WebhookDestinationError("dns_failure", "The webhook destination did not resolve to an address.");
  }
  if (addresses.some(({ address, family }) => isBlockedAddress(address, family))) {
    throw new WebhookDestinationError("blocked_destination", "The webhook destination is not publicly routable.");
  }

  return { url, addresses };
}

export async function validateAlertWebhookDestination(
  endpoint: string,
  options: Pick<DeliverAlertWebhookOptions, "allowHttpLocalhost" | "resolveAddresses"> = {},
) {
  return (await resolveAlertWebhookDestination(endpoint, options)).url;
}

export function classifyWebhookHttpFailure(status: number) {
  if (status === 408) {
    return { category: "request_timeout" as const, retryable: true };
  }
  if (status === 429) {
    return { category: "rate_limited" as const, retryable: true };
  }
  if (status >= 500) {
    return { category: "server_error" as const, retryable: true };
  }
  if (status >= 300 && status < 400) {
    return { category: "redirect" as const, retryable: false };
  }
  return { category: "client_error" as const, retryable: false };
}

export function parseWebhookRetryAfter(value: string | null, now = Date.now()) {
  if (!value) {
    return undefined;
  }

  const seconds = /^\d+$/.test(value.trim()) ? Number.parseInt(value.trim(), 10) : undefined;
  const unboundedMs = seconds === undefined ? Date.parse(value) - now : seconds * 1_000;
  if (!Number.isFinite(unboundedMs) || unboundedMs <= 0) {
    return undefined;
  }
  return Math.min(unboundedMs, MAX_RETRY_AFTER_MS);
}

async function consumeBoundedResponse(response: Response, maxBytes: number) {
  if (!response.body) {
    return { responseBytes: 0, responseTruncated: false };
  }

  const reader = response.body.getReader();
  let responseBytes = 0;
  let responseTruncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      responseBytes += value.byteLength;
      if (responseBytes > maxBytes) {
        responseBytes = maxBytes;
        responseTruncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { responseBytes, responseTruncated };
}

function createPinnedLookup(addresses: ResolvedAddress[]): NonNullable<RequestOptions["lookup"]> {
  return ((_hostname: string, lookupOptions: unknown, callback: (...args: unknown[]) => void) => {
    const requestedFamily =
      typeof lookupOptions === "object" && lookupOptions !== null && "family" in lookupOptions
        ? Number((lookupOptions as { family?: unknown }).family)
        : 0;
    const candidates = requestedFamily === 4 || requestedFamily === 6
      ? addresses.filter(({ family }) => family === requestedFamily)
      : addresses;

    if (candidates.length === 0) {
      const error = Object.assign(new Error("No validated address matches the requested family."), {
        code: "ENOTFOUND",
      });
      callback(error);
      return;
    }

    const returnAll =
      typeof lookupOptions === "object" &&
      lookupOptions !== null &&
      "all" in lookupOptions &&
      (lookupOptions as { all?: unknown }).all === true;
    if (returnAll) {
      callback(null, candidates);
      return;
    }

    callback(null, candidates[0].address, candidates[0].family);
  }) as NonNullable<RequestOptions["lookup"]>;
}

// The production transport connects only to the addresses validated immediately
// above while preserving the original hostname for Host and TLS verification.
// This avoids a second, attacker-controlled DNS lookup between validation and use.
async function sendPinnedWebhookRequest(
  destination: ValidatedDestination,
  headers: Headers,
  payloadBytes: Uint8Array,
  signal: AbortSignal,
  maxResponseBytes: number,
) {
  return new Promise<{ status: number; retryAfter: string | null; responseBytes: number; responseTruncated: boolean }>(
    (resolve, reject) => {
      const request = (destination.url.protocol === "https:" ? httpsRequest : httpRequest)(destination.url, {
        method: "POST",
        headers: Object.fromEntries(headers.entries()),
        signal,
        lookup: destination.addresses.length > 0 ? createPinnedLookup(destination.addresses) : undefined,
      }, (response) => {
        let responseBytes = 0;
        let responseTruncated = false;
        let settled = false;

        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          const retryAfterHeader = response.headers["retry-after"];
          resolve({
            status: response.statusCode ?? 0,
            retryAfter: Array.isArray(retryAfterHeader) ? retryAfterHeader[0] ?? null : retryAfterHeader ?? null,
            responseBytes,
            responseTruncated,
          });
        };

        response.on("data", (chunk: Buffer | string) => {
          responseBytes += Buffer.byteLength(chunk);
          if (responseBytes > maxResponseBytes) {
            responseBytes = maxResponseBytes;
            responseTruncated = true;
            finish();
            response.destroy();
          }
        });
        response.on("end", finish);
        response.on("error", (error) => {
          if (!settled) {
            reject(error);
          }
        });
      });

      request.on("error", reject);
      request.end(payloadBytes);
    },
  );
}

export async function deliverAlertWebhook(options: DeliverAlertWebhookOptions): Promise<WebhookDeliveryResult> {
  let destination: ValidatedDestination;
  try {
    destination = await resolveAlertWebhookDestination(options.endpoint, options);
  } catch (error) {
    if (error instanceof WebhookDestinationError) {
      return {
        ok: false,
        category: error.category,
        retryable: error.category === "dns_failure",
        safeMessage: error.message,
      };
    }
    return {
      ok: false,
      category: "invalid_destination",
      retryable: false,
      safeMessage: "The webhook destination is invalid.",
    };
  }

  const payloadBytes = serializeAlertWebhookPayload(options.payload);
  const headers = new Headers({
    "content-type": "application/json",
    "idempotency-key": options.eventId,
    "user-agent": "Stackray-Alerts/1",
    "x-stackray-event-id": options.eventId,
    "x-stackray-webhook-version": "1",
  });

  if (options.authorization) {
    headers.set("authorization", options.authorization);
  }
  if (options.signingSecret) {
    const signed = signAlertWebhookPayload(payloadBytes, options.signingSecret);
    headers.set("x-stackray-signature", signed.signature);
    headers.set("x-stackray-timestamp", signed.timestamp);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("The webhook timeout must be a positive integer.");
  }
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error("The webhook response limit must be a positive integer.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // fetchImpl is an injection seam for focused tests. Production uses the
    // pinned Node transport so DNS cannot change after destination validation.
    const response = options.fetchImpl
      ? await options.fetchImpl(destination.url, {
          method: "POST",
          redirect: "manual",
          headers,
          body: payloadBytes,
          signal: controller.signal,
        }).then(async (fetchResponse) => ({
          status: fetchResponse.status,
          retryAfter: fetchResponse.headers.get("retry-after"),
          ...await consumeBoundedResponse(fetchResponse, maxResponseBytes),
        }))
      : await sendPinnedWebhookRequest(destination, headers, payloadBytes, controller.signal, maxResponseBytes);

    if (response.status >= 200 && response.status < 300) {
      return {
        ok: true,
        httpStatus: response.status,
        responseBytes: response.responseBytes,
        responseTruncated: response.responseTruncated,
      };
    }

    const classification = classifyWebhookHttpFailure(response.status);
    return {
      ok: false,
      ...classification,
      httpStatus: response.status,
      retryAfterMs: classification.retryable
        ? parseWebhookRetryAfter(response.retryAfter, options.now?.())
        : undefined,
      safeMessage: `The webhook endpoint returned HTTP ${response.status}.`,
    };
  } catch {
    if (controller.signal.aborted) {
      return {
        ok: false,
        category: "timeout",
        retryable: true,
        safeMessage: "The webhook request timed out.",
      };
    }

    return {
      ok: false,
      category: "network_error",
      retryable: true,
      safeMessage: "The webhook request failed before a response was received.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
