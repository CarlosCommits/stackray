import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "../../db/client.ts";
import {
  alertChannels,
  alertDeliveries,
  alertEvents,
  alertPolicies,
  scanChangeItems,
  scanComparisons,
  scans,
} from "../../db/schema.ts";
import { RETIRED_CHANGE_TYPES } from "../../changes/change-types.ts";
import { env } from "../../env/server.ts";
import {
  getRequiredInstancePublicOrigin,
  InstancePublicOriginUnavailableError,
} from "../instance-runtime-settings.ts";
import {
  alertEventSummarySchema,
  createAlertWebhookPayload,
} from "./alert-payload.ts";
import { deliverAlertEmail } from "./email-delivery.ts";
import { buildChangeAlertEmail } from "../email/templates/change-alert.ts";
import {
  AlertSecretCryptoError,
  getOptionalConfiguredAlertEncryptionKey,
  protectAlertSecret,
  readStoredAlertSecret,
} from "./secret-encryption.ts";
import { deliverAlertWebhook } from "./webhook-delivery.ts";
import { deliverSlackAlert } from "./slack-delivery.ts";

const DEFAULT_MAX_ATTEMPTS = 8;
const MAX_DELIVERED_CHANGE_ITEMS = 25;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1_000;
const INITIAL_READINESS_RETRY_DELAY_MS = 30_000;
const MAX_READINESS_RETRY_DELAY_MS = 5 * 60_000;

type DeliveryFailure = {
  category: string;
  retryable: boolean;
  safeMessage: string;
  providerStatusCode?: number;
  retryAfterMs?: number;
};

const emailConfigSchema = z.object({
  recipients: z.array(z.email()).min(1).max(25),
});

const webhookSecretSchema = z.object({
  endpoint: z.url().max(2_048),
  authorization: z.string().min(1).max(2_048).optional(),
  signingSecret: z.string().min(16).max(512).optional(),
});

const slackSecretSchema = z.object({
  webhookUrl: z.url().max(2_048),
});

export class RetryableAlertDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableAlertDeliveryError";
  }
}

export type DeferredAlertDelivery = {
  status: "deferred";
  channelId: string;
  retryAt: Date;
};

export function readinessRetryDelayMs(deferralCount: number) {
  return Math.min(
    2 ** Math.min(Math.max(0, deferralCount), 10) * INITIAL_READINESS_RETRY_DELAY_MS,
    MAX_READINESS_RETRY_DELAY_MS,
  );
}

function nextRetryDelayMs(attemptCount: number, providerDelay?: number) {
  if (providerDelay !== undefined) {
    return Math.min(providerDelay, MAX_RETRY_DELAY_MS);
  }
  return Math.min(2 ** Math.max(0, attemptCount - 1) * 5_000, MAX_RETRY_DELAY_MS);
}

async function updateEventAggregate(eventId: string) {
  const [event, deliveries] = await Promise.all([
    db.select({ state: alertEvents.state }).from(alertEvents).where(eq(alertEvents.id, eventId)).limit(1),
    db.select({ status: alertDeliveries.status }).from(alertDeliveries).where(eq(alertDeliveries.eventId, eventId)),
  ]).then(([events, rows]) => [events[0], rows] as const);

  if (!event || event.state === "suppressed" || deliveries.length === 0) {
    return;
  }

  const hasInFlight = deliveries.some(({ status }) => ["pending", "queued", "delivering", "retrying"].includes(status));
  const deliveredCount = deliveries.filter(({ status }) => status === "delivered").length;
  const now = new Date();
  const state = hasInFlight
    ? "delivering" as const
    : deliveredCount === deliveries.length
      ? "delivered" as const
      : deliveredCount > 0
        ? "partially_failed" as const
        : "failed" as const;

  await db.update(alertEvents).set({
    state,
    completedAt: hasInFlight ? null : now,
    updatedAt: now,
  }).where(eq(alertEvents.id, eventId));
}

async function recordDeliveryFailure(
  delivery: typeof alertDeliveries.$inferSelect,
  attemptCount: number,
  failure: DeliveryFailure,
  maxAttempts: number,
) {
  const now = new Date();
  const willRetry = failure.retryable && attemptCount < maxAttempts;
  await db.update(alertDeliveries).set({
    status: willRetry ? "retrying" : "failed",
    nextAttemptAt: willRetry
      ? new Date(now.getTime() + nextRetryDelayMs(attemptCount, failure.retryAfterMs))
      : null,
    providerResponseClass: failure.category.slice(0, 120),
    providerStatusCode: failure.providerStatusCode ?? null,
    redactedError: failure.safeMessage.slice(0, 1_000),
    failedAt: willRetry ? null : now,
    updatedAt: now,
  }).where(eq(alertDeliveries.id, delivery.id));
  await updateEventAggregate(delivery.eventId);

  if (willRetry) {
    throw new RetryableAlertDeliveryError(failure.safeMessage);
  }
}

/** Runs one durable delivery. Permanent failures are recorded and resolved; only
 * transient failures throw so Graphile Worker applies its retry schedule. */
export async function deliverAlert(
  deliveryId: string,
  options: { maxAttempts?: number; readinessDeferralCount?: number } = {},
): Promise<DeferredAlertDelivery | undefined> {
  const [context] = await db
    .select({
      delivery: alertDeliveries,
      event: alertEvents,
      channel: alertChannels,
      policy: alertPolicies,
      comparison: scanComparisons,
      scan: scans,
    })
    .from(alertDeliveries)
    .innerJoin(alertEvents, eq(alertEvents.id, alertDeliveries.eventId))
    .innerJoin(alertChannels, eq(alertChannels.id, alertDeliveries.channelId))
    .innerJoin(alertPolicies, eq(alertPolicies.id, alertEvents.policyId))
    .innerJoin(scanComparisons, eq(scanComparisons.id, alertEvents.comparisonId))
    .innerJoin(scans, eq(scans.id, scanComparisons.comparisonScanId))
    .where(eq(alertDeliveries.id, deliveryId))
    .limit(1);

  if (!context || ["delivered", "failed", "cancelled"].includes(context.delivery.status)) {
    return;
  }

  if (!context.channel.enabled || context.channel.deletedAt || context.policy.deletedAt || context.policy.state !== "enabled") {
    await recordDeliveryFailure(context.delivery, context.delivery.attemptCount, {
      category: "channel_unavailable",
      retryable: false,
      safeMessage: "The notification channel or policy is no longer enabled.",
    }, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    return;
  }

  const now = new Date();
  let publicOrigin: string;

  try {
    publicOrigin = await getRequiredInstancePublicOrigin();
  } catch (error) {
    if (!(error instanceof InstancePublicOriginUnavailableError)) {
      throw error;
    }

    const retryAt = new Date(now.getTime() + readinessRetryDelayMs(options.readinessDeferralCount ?? 0));
    const [deferred] = await db.update(alertDeliveries).set({
      status: "retrying",
      nextAttemptAt: retryAt,
      providerResponseClass: "public_origin_unavailable",
      redactedError: "Waiting for the Stackray website migration to register its public URL.",
      failedAt: null,
      updatedAt: now,
    }).where(and(
      eq(alertDeliveries.id, deliveryId),
      inArray(alertDeliveries.status, ["pending", "queued", "delivering", "retrying"]),
    )).returning({ id: alertDeliveries.id });

    if (!deferred) {
      return;
    }

    await updateEventAggregate(context.event.id);

    return {
      status: "deferred",
      channelId: context.channel.id,
      retryAt,
    };
  }

  const [claimed] = await db.update(alertDeliveries).set({
    status: "delivering",
    attemptCount: context.delivery.attemptCount + 1,
    lastAttemptAt: now,
    nextAttemptAt: null,
    redactedError: null,
    updatedAt: now,
  }).where(and(
    eq(alertDeliveries.id, deliveryId),
    inArray(alertDeliveries.status, ["pending", "queued", "retrying"]),
  )).returning();

  if (!claimed) {
    return;
  }
  await db.update(alertEvents).set({ state: "delivering", updatedAt: now })
    .where(and(eq(alertEvents.id, context.event.id), isNull(alertEvents.completedAt)));

  let summary: z.infer<typeof alertEventSummarySchema>;
  try {
    summary = alertEventSummarySchema.parse(context.event.summaryJson);
  } catch {
    await recordDeliveryFailure(claimed, claimed.attemptCount, {
      category: "invalid_event",
      retryable: false,
      safeMessage: "The stored alert event is invalid.",
    }, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    return;
  }

  const changes = summary.matchedItemIds.length > 0
    ? await db.select().from(scanChangeItems).where(and(
        eq(scanChangeItems.comparisonId, context.comparison.id),
        inArray(scanChangeItems.id, summary.matchedItemIds),
        notInArray(scanChangeItems.changeType, RETIRED_CHANGE_TYPES),
      )).limit(MAX_DELIVERED_CHANGE_ITEMS)
    : [];
  let failure: DeliveryFailure | null = null;
  let providerMessageId: string | null = null;
  let providerStatusCode: number | null = null;
  try {
    const payload = createAlertWebhookPayload({
      eventId: context.event.id,
      eventCreatedAt: context.event.createdAt,
      comparisonId: context.comparison.id,
      publicOrigin,
      summary,
      changes: changes.map((change) => ({
        id: change.id,
        category: change.category,
        changeType: change.changeType,
        summary: change.summary,
        endpointIdentity: change.endpointIdentity,
        before: change.beforeJson,
        after: change.afterJson,
      })),
    });

    if (context.channel.channelType === "email") {
      const config = emailConfigSchema.parse(context.channel.configJson);
      const email = buildChangeAlertEmail(payload, { assetOrigin: publicOrigin });
      const result = await deliverAlertEmail({
        to: config.recipients,
        ...email,
      });
      if (result.ok) {
        providerMessageId = result.providerMessageId;
      } else {
        failure = result;
      }
    } else if (context.channel.channelType === "slack") {
      const key = getOptionalConfiguredAlertEncryptionKey();
      const decrypted = readStoredAlertSecret(context.channel, key);
      const secret = slackSecretSchema.parse(JSON.parse(decrypted));
      if (context.channel.secretPlaintext !== null && key !== null) {
        await db.update(alertChannels).set({
          ...protectAlertSecret(decrypted, key),
          updatedAt: now,
        }).where(eq(alertChannels.id, context.channel.id));
      }
      const result = await deliverSlackAlert({ webhookUrl: secret.webhookUrl, payload });
      if (result.ok) {
        providerStatusCode = result.httpStatus;
      } else {
        failure = {
          category: result.category,
          retryable: result.retryable,
          safeMessage: result.safeMessage,
          providerStatusCode: result.httpStatus,
          retryAfterMs: result.retryAfterMs,
        };
      }
    } else {
      const key = getOptionalConfiguredAlertEncryptionKey();
      const decrypted = readStoredAlertSecret(context.channel, key);
      const secret = webhookSecretSchema.parse(JSON.parse(decrypted));
      if (context.channel.secretPlaintext !== null && key !== null) {
        await db.update(alertChannels).set({
          ...protectAlertSecret(decrypted, key),
          updatedAt: now,
        }).where(eq(alertChannels.id, context.channel.id));
      }
      const result = await deliverAlertWebhook({
        endpoint: secret.endpoint,
        eventId: context.event.id,
        payload,
        authorization: secret.authorization,
        signingSecret: secret.signingSecret,
        allowHttpLocalhost: env.NODE_ENV === "development",
      });
      if (result.ok) {
        providerStatusCode = result.httpStatus;
      } else {
        failure = {
          category: result.category,
          retryable: result.retryable,
          safeMessage: result.safeMessage,
          providerStatusCode: result.httpStatus,
          retryAfterMs: result.retryAfterMs,
        };
      }
    }
  } catch (error) {
    failure = {
      category: error instanceof AlertSecretCryptoError
        ? error.code
        : "invalid_configuration",
      retryable: false,
      safeMessage: error instanceof AlertSecretCryptoError
        ? "The notification credentials could not be read. Check STACKRAY_ENCRYPTION_KEY and the stored channel configuration."
        : "The notification channel configuration is invalid.",
    };
  }

  if (failure) {
    await recordDeliveryFailure(claimed, claimed.attemptCount, failure, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    return;
  }

  const deliveredAt = new Date();
  await db.update(alertDeliveries).set({
    status: "delivered",
    providerResponseClass: "success",
    providerStatusCode,
    providerMessageId,
    redactedError: null,
    deliveredAt,
    failedAt: null,
    nextAttemptAt: null,
    updatedAt: deliveredAt,
  }).where(eq(alertDeliveries.id, deliveryId));
  await updateEventAggregate(context.event.id);
}
