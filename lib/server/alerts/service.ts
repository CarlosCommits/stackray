import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { canManageAlerts } from "@/lib/authorization/authz";
import {
  alertChannelSchema,
  alertPolicyConditionsSchema,
  alertPolicySchema,
  alertSetupReadinessSchema,
  deleteAlertChannelResponseSchema,
  deleteAlertPolicyResponseSchema,
  listAlertChannelsResponseSchema,
  listAlertPoliciesResponseSchema,
  slackAlertChannelConfigSchema,
  testAlertChannelResponseSchema,
  type AlertChannel,
  type AlertPolicy,
  type CreateAlertChannelRequest,
  type CreateAlertPolicyRequest,
  type UpdateAlertChannelRequest,
  type UpdateAlertPolicyRequest,
} from "@/lib/contracts/alerts";
import { db } from "@/lib/db/client";
import {
  alertChannels,
  alertPolicies,
  alertPolicyChannels,
  alertPolicySchedules,
  alertPolicyTargets,
  canonicalTargets,
  scanScheduleTargets,
} from "@/lib/db/schema";
import { env } from "@/lib/env/server";
import type { ActorContext } from "@/lib/session/actor-context";
import { canSendAlertEmail, deliverAlertEmail } from "@/lib/server/alerts/email-delivery";
import { getEmailProviderSettings } from "@/lib/server/email/settings-service";
import { buildTestEmail } from "@/lib/server/email/templates/test-email";
import { getRequiredInstancePublicOrigin } from "@/lib/server/instance-runtime-settings";
import { deliverSlackAlert, validateSlackWebhookUrl } from "@/lib/server/alerts/slack-delivery";
import {
  AlertSecretCryptoError,
  getConfiguredAlertEncryptionKey,
  getOptionalConfiguredAlertEncryptionKey,
  protectAlertSecret,
  readStoredAlertSecret,
} from "@/lib/server/alerts/secret-encryption";
import { deliverAlertWebhook, validateAlertWebhookDestination } from "@/lib/server/alerts/webhook-delivery";
import type { AlertWebhookPayload } from "@/lib/server/alerts/webhook-payload";

const webhookSecretSchema = z.object({
  endpoint: z.url().max(2_048),
  authorization: z.string().min(1).max(2_048).optional(),
  signingSecret: z.string().min(16).max(512).optional(),
});

const slackSecretSchema = z.object({
  webhookUrl: z.url().max(2_048),
});

const ALERT_SETTINGS_LIST_LIMIT = 100;

function assertCanManageAlerts(actor: ActorContext) {
  if (!canManageAlerts(actor)) {
    throw new Error("You do not have permission to manage alerting.");
  }
}

function mapAlertChannel(row: typeof alertChannels.$inferSelect): AlertChannel {
  const common = {
    id: row.id,
    displayName: row.displayName,
    channelType: row.channelType,
    enabled: row.enabled,
    lastTestStatus: row.lastTestStatus,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestErrorCategory: row.lastTestErrorCategory,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.channelType === "email") {
    return alertChannelSchema.parse({
      ...common,
      channelType: "email",
      config: row.configJson,
    });
  }

  if (row.channelType === "slack") {
    return alertChannelSchema.parse({
      ...common,
      channelType: "slack",
      config: row.configJson,
    });
  }

  return alertChannelSchema.parse({
    ...common,
    channelType: "webhook",
    config: row.configJson,
  });
}

function mapAlertPolicy(
  row: typeof alertPolicies.$inferSelect,
  channelIds: string[],
  targetIds: string[],
): AlertPolicy {
  return alertPolicySchema.parse({
    id: row.id,
    name: row.name,
    state: row.state,
    coverage: row.coverage,
    conditions: row.conditionsJson,
    cooldownSeconds: row.cooldownSeconds,
    channelIds,
    targetIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function createTestWebhookPayload(
  channelId: string,
  now: Date,
  publicOrigin: string,
): AlertWebhookPayload {
  const eventId = randomUUID();
  return {
    schemaVersion: 2,
    event: {
      id: eventId,
      type: "scan.changes.detected",
      occurredAt: now.toISOString(),
    },
    target: {
      id: "test-target",
      label: "Stackray test notification",
      url: "https://example.com",
    },
    comparison: {
      id: `test-${channelId}`,
      currentScanId: "test-current-scan",
      baselineScanId: "test-baseline-scan",
      url: new URL("/settings/alerts", publicOrigin).toString(),
    },
    summary: {
      headline: "Stackray alert channel test",
      totalChanges: 1,
      includedChanges: 1,
    },
    changes: [{
      id: "test-change",
      category: "setup",
      type: "alert_channel.test",
      summary: "Your Stackray alert channel is configured correctly.",
    }],
  };
}

export async function getAlertSetupReadiness(options: { emailReady?: boolean } = {}) {
  const emailReady = options.emailReady ?? await canSendAlertEmail();

  const webhookStatus = "ready" as const;
  let webhookDetail = "Encrypted webhook channels are available.";
  let webhookMissing: string[] = [];
  try {
    getConfiguredAlertEncryptionKey();
  } catch (error) {
    if (error instanceof AlertSecretCryptoError && error.code === "missing_key") {
      webhookDetail = "Webhooks are available, but credentials are stored without application-layer encryption.";
      webhookMissing = ["STACKRAY_ENCRYPTION_KEY"];
    } else {
      webhookDetail = "Webhooks are available without encryption because STACKRAY_ENCRYPTION_KEY is invalid.";
      webhookMissing = ["STACKRAY_ENCRYPTION_KEY"];
    }
  }

  return alertSetupReadinessSchema.parse({
    inAppChanges: {
      status: "ready",
      detail: "Change history is built in and does not require a notification provider.",
      missingEnvironmentVariables: [],
    },
    email: {
      status: emailReady ? "ready" : "needs_configuration",
      detail: emailReady
        ? "Email notifications use the configured Resend account."
        : "Connect Resend to create and test email channels.",
      missingEnvironmentVariables: [],
    },
    webhooks: {
      status: webhookStatus,
      detail: webhookDetail,
      missingEnvironmentVariables: webhookMissing,
    },
    deliveryWorker: {
      status: "unverified",
      detail: "Worker heartbeat reporting is not available yet. Alert deliveries use the intel worker or a single all-role worker.",
      missingEnvironmentVariables: [],
    },
  });
}

export async function listAlertChannels(actor: ActorContext) {
  assertCanManageAlerts(actor);

  const rows = await db
    .select()
    .from(alertChannels)
    .where(isNull(alertChannels.deletedAt))
    .orderBy(desc(alertChannels.createdAt))
    .limit(ALERT_SETTINGS_LIST_LIMIT);

  return listAlertChannelsResponseSchema.parse({ items: rows.map(mapAlertChannel) });
}

export async function createAlertChannel(actor: ActorContext, input: CreateAlertChannelRequest) {
  assertCanManageAlerts(actor);

  if (input.channelType === "email") {
    if (!await canSendAlertEmail()) {
      throw new Error("Connect Resend before creating an email notification channel.");
    }

    const recipients = [...new Set(input.recipients.map((recipient) => recipient.toLowerCase()))].toSorted();
    const [row] = await db.insert(alertChannels).values({
      displayName: input.displayName,
      channelType: "email",
      enabled: input.enabled,
      configJson: { recipients },
      createdByUserId: actor.user.id,
      updatedByUserId: actor.user.id,
    }).returning();

    return mapAlertChannel(row);
  }

  if (input.channelType === "slack") {
    const webhookUrl = validateSlackWebhookUrl(input.webhookUrl);
    const storedSecret = protectAlertSecret(
      JSON.stringify(slackSecretSchema.parse({ webhookUrl: webhookUrl.toString() })),
      getOptionalConfiguredAlertEncryptionKey(),
    );
    const [row] = await db.insert(alertChannels).values({
      displayName: input.displayName,
      channelType: "slack",
      enabled: input.enabled,
      configJson: {
        workspaceId: null,
        workspaceName: input.workspaceName ?? null,
        channelId: null,
        channelName: input.channelName,
        connectionSource: "manual",
        configurationUrl: null,
      },
      ...storedSecret,
      createdByUserId: actor.user.id,
      updatedByUserId: actor.user.id,
    }).returning();

    return mapAlertChannel(row);
  }

  const allowHttpLocalhost = env.NODE_ENV === "development";
  const endpoint = await validateAlertWebhookDestination(input.endpoint, { allowHttpLocalhost });
  const secret = webhookSecretSchema.parse({
    endpoint: endpoint.toString(),
    authorization: input.authorizationHeader,
    signingSecret: input.signingSecret,
  });
  const storedSecret = protectAlertSecret(
    JSON.stringify(secret),
    getOptionalConfiguredAlertEncryptionKey(),
  );

  const [row] = await db.insert(alertChannels).values({
    displayName: input.displayName,
    channelType: "webhook",
    enabled: input.enabled,
    configJson: {
      hostname: endpoint.hostname,
      hasAuthorizationHeader: Boolean(secret.authorization),
      hasSigningSecret: Boolean(secret.signingSecret),
    },
    ...storedSecret,
    createdByUserId: actor.user.id,
    updatedByUserId: actor.user.id,
  }).returning();

  return mapAlertChannel(row);
}

async function getActiveAlertChannel(channelId: string) {
  const [row] = await db.select().from(alertChannels).where(and(
    eq(alertChannels.id, channelId),
    isNull(alertChannels.deletedAt),
  )).limit(1);

  if (!row) {
    throw new Error("The requested notification channel could not be found.");
  }

  return row;
}

export async function updateAlertChannel(
  actor: ActorContext,
  channelId: string,
  input: UpdateAlertChannelRequest,
) {
  assertCanManageAlerts(actor);
  const current = await getActiveAlertChannel(channelId);

  if (!("channelType" in input)) {
    if (current.channelType === "email" && input.enabled && !await canSendAlertEmail()) {
      throw new Error("Connect Resend before enabling an email notification channel.");
    }

    const [row] = await db.update(alertChannels).set({
      enabled: input.enabled,
      updatedAt: new Date(),
      updatedByUserId: actor.user.id,
    }).where(and(eq(alertChannels.id, channelId), isNull(alertChannels.deletedAt))).returning();

    return mapAlertChannel(row);
  }

  if (current.channelType !== input.channelType) {
    throw new Error("Notification channel types cannot be changed after creation.");
  }

  const now = new Date();
  if (input.channelType === "email") {
    if (input.enabled && !await canSendAlertEmail()) {
      throw new Error("Connect Resend before enabling an email notification channel.");
    }

    const recipients = [...new Set(input.recipients.map((recipient) => recipient.toLowerCase()))].toSorted();
    const [row] = await db.update(alertChannels).set({
      displayName: input.displayName,
      enabled: input.enabled,
      configJson: { recipients },
      lastTestStatus: "untested",
      lastTestedAt: null,
      lastTestErrorCategory: null,
      updatedAt: now,
      updatedByUserId: actor.user.id,
    }).where(and(eq(alertChannels.id, channelId), isNull(alertChannels.deletedAt))).returning();

    return mapAlertChannel(row);
  }

  if (input.channelType === "slack") {
    const secretChanged = input.webhookUrl !== undefined;
    let secretUpdate: Partial<typeof alertChannels.$inferInsert> = {};
    if (input.webhookUrl) {
      const webhookUrl = validateSlackWebhookUrl(input.webhookUrl);
      secretUpdate = protectAlertSecret(
        JSON.stringify(slackSecretSchema.parse({ webhookUrl: webhookUrl.toString() })),
        getOptionalConfiguredAlertEncryptionKey(),
      );
    }
    const currentConfig = slackAlertChannelConfigSchema.parse(current.configJson);
    const [row] = await db.update(alertChannels).set({
      displayName: input.displayName,
      enabled: input.enabled,
      configJson: {
        ...currentConfig,
        workspaceName: input.workspaceName ?? null,
        channelName: input.channelName,
        ...(secretChanged ? {
          workspaceId: null,
          channelId: null,
          connectionSource: "manual" as const,
          configurationUrl: null,
        } : {}),
      },
      ...secretUpdate,
      ...(secretChanged ? {
        lastTestStatus: "untested" as const,
        lastTestedAt: null,
        lastTestErrorCategory: null,
      } : {}),
      updatedAt: now,
      updatedByUserId: actor.user.id,
    }).where(and(eq(alertChannels.id, channelId), isNull(alertChannels.deletedAt))).returning();

    return mapAlertChannel(row);
  }

  const secretChanged = input.endpoint !== undefined
    || input.authorizationHeader !== undefined
    || input.signingSecret !== undefined
    || input.clearAuthorizationHeader
    || input.clearSigningSecret;
  let secretUpdate: Partial<typeof alertChannels.$inferInsert> = {};
  let configJson = current.configJson;
  if (secretChanged) {
    const currentSecret = webhookSecretSchema.parse(JSON.parse(readStoredAlertSecret(
      current,
      getOptionalConfiguredAlertEncryptionKey(),
    )));
    const endpoint = input.endpoint
      ? await validateAlertWebhookDestination(input.endpoint, { allowHttpLocalhost: env.NODE_ENV === "development" })
      : new URL(currentSecret.endpoint);
    const nextSecret = webhookSecretSchema.parse({
      endpoint: endpoint.toString(),
      authorization: input.clearAuthorizationHeader
        ? undefined
        : input.authorizationHeader ?? currentSecret.authorization,
      signingSecret: input.clearSigningSecret
        ? undefined
        : input.signingSecret ?? currentSecret.signingSecret,
    });
    secretUpdate = protectAlertSecret(
      JSON.stringify(nextSecret),
      getOptionalConfiguredAlertEncryptionKey(),
    );
    configJson = {
      hostname: endpoint.hostname,
      hasAuthorizationHeader: Boolean(nextSecret.authorization),
      hasSigningSecret: Boolean(nextSecret.signingSecret),
    };
  }

  const [row] = await db.update(alertChannels).set({
    displayName: input.displayName,
    enabled: input.enabled,
    configJson,
    ...secretUpdate,
    ...(secretChanged ? {
      lastTestStatus: "untested" as const,
      lastTestedAt: null,
      lastTestErrorCategory: null,
    } : {}),
    updatedAt: now,
    updatedByUserId: actor.user.id,
  }).where(and(eq(alertChannels.id, channelId), isNull(alertChannels.deletedAt))).returning();

  return mapAlertChannel(row);
}

export async function deleteAlertChannel(actor: ActorContext, channelId: string) {
  assertCanManageAlerts(actor);
  await getActiveAlertChannel(channelId);

  await db.transaction(async (tx) => {
    await tx.delete(alertPolicyChannels).where(eq(alertPolicyChannels.channelId, channelId));
    await tx.update(alertChannels).set({
      enabled: false,
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: actor.user.id,
    }).where(eq(alertChannels.id, channelId));
  });

  return deleteAlertChannelResponseSchema.parse({ deletedChannelId: channelId });
}

export async function testAlertChannel(actor: ActorContext, channelId: string) {
  assertCanManageAlerts(actor);
  const row = await getActiveAlertChannel(channelId);
  const now = new Date();
  let delivered = false;
  let category: string | null = null;
  let message: string;

  try {
    if (row.channelType === "email") {
      const config = z.object({ recipients: z.array(z.email()).min(1) }).parse(row.configJson);
      const email = buildTestEmail("channel");
      const result = await deliverAlertEmail({
        to: config.recipients,
        ...email,
      });
      delivered = result.ok;
      category = result.ok ? null : result.category;
      message = result.ok ? "Test email sent." : result.safeMessage;
    } else if (row.channelType === "slack") {
      const publicOrigin = await getRequiredInstancePublicOrigin();
      const key = getOptionalConfiguredAlertEncryptionKey();
      const decrypted = readStoredAlertSecret(row, key);
      const secret = slackSecretSchema.parse(JSON.parse(decrypted));
      if (row.secretPlaintext !== null && key !== null) {
        await db.update(alertChannels).set({
          ...protectAlertSecret(decrypted, key),
          updatedAt: now,
          updatedByUserId: actor.user.id,
        }).where(eq(alertChannels.id, row.id));
      }
      const result = await deliverSlackAlert({
        webhookUrl: secret.webhookUrl,
        payload: createTestWebhookPayload(row.id, now, publicOrigin),
      });
      delivered = result.ok;
      category = result.ok ? null : result.category;
      message = result.ok ? "Test Slack notification delivered." : result.safeMessage;
    } else {
      const publicOrigin = await getRequiredInstancePublicOrigin();
      const key = getOptionalConfiguredAlertEncryptionKey();
      const decrypted = readStoredAlertSecret(row, key);
      const secret = webhookSecretSchema.parse(JSON.parse(decrypted));
      if (row.secretPlaintext !== null && key !== null) {
        await db.update(alertChannels).set({
          ...protectAlertSecret(decrypted, key),
          updatedAt: now,
          updatedByUserId: actor.user.id,
        }).where(eq(alertChannels.id, row.id));
      }
      const payload = createTestWebhookPayload(row.id, now, publicOrigin);
      const result = await deliverAlertWebhook({
        endpoint: secret.endpoint,
        eventId: payload.event.id,
        payload,
        authorization: secret.authorization,
        signingSecret: secret.signingSecret,
        allowHttpLocalhost: env.NODE_ENV === "development",
      });
      delivered = result.ok;
      category = result.ok ? null : result.category;
      message = result.ok ? "Test webhook delivered." : result.safeMessage;
    }
  } catch (error) {
    category = error instanceof AlertSecretCryptoError ? error.code : "invalid_configuration";
    message = error instanceof AlertSecretCryptoError
      ? "The notification credentials could not be read. Check STACKRAY_ENCRYPTION_KEY and the stored channel configuration."
      : "The notification channel configuration is invalid.";
  }

  const [updated] = await db.update(alertChannels).set({
    lastTestStatus: delivered ? "succeeded" : "failed",
    lastTestedAt: now,
    lastTestErrorCategory: category,
    updatedAt: now,
    updatedByUserId: actor.user.id,
  }).where(eq(alertChannels.id, row.id)).returning();

  return testAlertChannelResponseSchema.parse({
    channel: mapAlertChannel(updated),
    delivered,
    message,
  });
}

export async function connectSlackAlertChannel(actor: ActorContext, input: {
  existingChannelId?: string;
  workspaceId: string;
  workspaceName: string;
  channelId: string;
  channelName: string;
  configurationUrl: string;
  webhookUrl: string;
}) {
  assertCanManageAlerts(actor);
  const webhookUrl = validateSlackWebhookUrl(input.webhookUrl);
  const storedSecret = protectAlertSecret(
    JSON.stringify(slackSecretSchema.parse({ webhookUrl: webhookUrl.toString() })),
    getOptionalConfiguredAlertEncryptionKey(),
  );
  const configJson = {
    workspaceId: input.workspaceId,
    workspaceName: input.workspaceName,
    channelId: input.channelId,
    channelName: input.channelName.replace(/^#/, ""),
    connectionSource: "oauth" as const,
    configurationUrl: input.configurationUrl,
  };
  const now = new Date();

  if (input.existingChannelId) {
    const current = await getActiveAlertChannel(input.existingChannelId);
    if (current.channelType !== "slack") {
      throw new Error("Only Slack notification channels can be reconnected to Slack.");
    }
    const [row] = await db.update(alertChannels).set({
      configJson,
      ...storedSecret,
      lastTestStatus: "untested",
      lastTestedAt: null,
      lastTestErrorCategory: null,
      updatedAt: now,
      updatedByUserId: actor.user.id,
    }).where(and(
      eq(alertChannels.id, input.existingChannelId),
      isNull(alertChannels.deletedAt),
    )).returning();
    return mapAlertChannel(row);
  }

  const displayName = `Slack #${configJson.channelName}`.slice(0, 100);
  const [row] = await db.insert(alertChannels).values({
    displayName,
    channelType: "slack",
    enabled: true,
    configJson,
    ...storedSecret,
    createdByUserId: actor.user.id,
    updatedByUserId: actor.user.id,
  }).returning();
  return mapAlertChannel(row);
}

export async function listAlertPolicies(actor: ActorContext) {
  assertCanManageAlerts(actor);

  const rows = await db.select().from(alertPolicies)
    .where(isNull(alertPolicies.deletedAt))
    .orderBy(desc(alertPolicies.createdAt))
    .limit(ALERT_SETTINGS_LIST_LIMIT);
  const policyIds = rows.map((row) => row.id);
  const [channelRows, targetRows] = policyIds.length > 0
    ? await Promise.all([
        db.select().from(alertPolicyChannels).where(inArray(alertPolicyChannels.policyId, policyIds)),
        db.select().from(alertPolicyTargets).where(inArray(alertPolicyTargets.policyId, policyIds)),
      ])
    : [[], []];
  const channelIdsByPolicy = new Map<string, string[]>();
  const targetIdsByPolicy = new Map<string, string[]>();
  for (const channel of channelRows) {
    const channelIds = channelIdsByPolicy.get(channel.policyId) ?? [];
    channelIds.push(channel.channelId);
    channelIdsByPolicy.set(channel.policyId, channelIds);
  }
  for (const target of targetRows) {
    const targetIds = targetIdsByPolicy.get(target.policyId) ?? [];
    targetIds.push(target.canonicalTargetId);
    targetIdsByPolicy.set(target.policyId, targetIds);
  }

  return listAlertPoliciesResponseSchema.parse({
    items: rows.map((row) => mapAlertPolicy(
      row,
      (channelIdsByPolicy.get(row.id) ?? []).toSorted(),
      (targetIdsByPolicy.get(row.id) ?? []).toSorted(),
    )),
  });
}

export async function getTargetAlertCoverage(actor: ActorContext, canonicalTargetId: string) {
  assertCanManageAlerts(actor);

  const policies = await db.select({
    id: alertPolicies.id,
    coverage: alertPolicies.coverage,
  }).from(alertPolicies).where(and(
    eq(alertPolicies.state, "enabled"),
    isNull(alertPolicies.deletedAt),
  )).limit(ALERT_SETTINGS_LIST_LIMIT);

  if (policies.length === 0) {
    return { coveredPolicyCount: 0, readyPolicyCount: 0 };
  }

  const policyIds = policies.map((policy) => policy.id);
  const [targetLinks, scheduleLinks, channelLinks] = await Promise.all([
    db.selectDistinct({ policyId: alertPolicyTargets.policyId })
      .from(alertPolicyTargets)
      .where(and(
        inArray(alertPolicyTargets.policyId, policyIds),
        eq(alertPolicyTargets.canonicalTargetId, canonicalTargetId),
      ))
      .limit(ALERT_SETTINGS_LIST_LIMIT),
    db.selectDistinct({ policyId: alertPolicySchedules.policyId })
      .from(alertPolicySchedules)
      .innerJoin(scanScheduleTargets, eq(scanScheduleTargets.scheduleId, alertPolicySchedules.scheduleId))
      .where(and(
        inArray(alertPolicySchedules.policyId, policyIds),
        eq(scanScheduleTargets.canonicalTargetId, canonicalTargetId),
      ))
      .limit(ALERT_SETTINGS_LIST_LIMIT),
    db.selectDistinct({ policyId: alertPolicyChannels.policyId })
      .from(alertPolicyChannels)
      .innerJoin(alertChannels, and(
        eq(alertChannels.id, alertPolicyChannels.channelId),
        eq(alertChannels.enabled, true),
        isNull(alertChannels.deletedAt),
      ))
      .where(inArray(alertPolicyChannels.policyId, policyIds))
      .limit(ALERT_SETTINGS_LIST_LIMIT),
  ]);

  const selectedTargetPolicyIds = new Set(targetLinks.map((link) => link.policyId));
  const selectedSchedulePolicyIds = new Set(scheduleLinks.map((link) => link.policyId));
  const policiesWithEnabledChannels = new Set(channelLinks.map((link) => link.policyId));
  const coveredPolicyIds = policies.flatMap((policy) => {
    const covered = policy.coverage === "all_targets"
      || (policy.coverage === "selected_targets" && selectedTargetPolicyIds.has(policy.id))
      || (policy.coverage === "selected_schedules" && selectedSchedulePolicyIds.has(policy.id));

    return covered ? [policy.id] : [];
  });

  return {
    coveredPolicyCount: coveredPolicyIds.length,
    readyPolicyCount: coveredPolicyIds.filter((policyId) => policiesWithEnabledChannels.has(policyId)).length,
  };
}

async function validateAlertPolicyLinks(input: CreateAlertPolicyRequest) {
  const channelIds = [...new Set(input.channelIds)];
  const targetIds = input.coverage === "selected_targets" ? [...new Set(input.targetIds)] : [];
  const [availableChannels, availableTargets] = await Promise.all([
    db.select({ id: alertChannels.id }).from(alertChannels).where(and(
      inArray(alertChannels.id, channelIds),
      isNull(alertChannels.deletedAt),
    )),
    targetIds.length > 0
      ? db.select({ id: canonicalTargets.id }).from(canonicalTargets).where(inArray(canonicalTargets.id, targetIds))
      : Promise.resolve([]),
  ]);
  if (availableChannels.length !== channelIds.length) {
    throw new Error("One or more selected notification channels could not be found.");
  }
  if (availableTargets.length !== targetIds.length) {
    throw new Error("One or more selected targets could not be found.");
  }

  return { channelIds, targetIds };
}

export async function createAlertPolicy(actor: ActorContext, input: CreateAlertPolicyRequest) {
  assertCanManageAlerts(actor);
  const { channelIds, targetIds } = await validateAlertPolicyLinks(input);

  const conditions = alertPolicyConditionsSchema.parse(input.conditions);
  const policy = await db.transaction(async (tx) => {
    const [row] = await tx.insert(alertPolicies).values({
      name: input.name,
      state: input.state,
      coverage: input.coverage,
      conditionsJson: conditions,
      conditionsSchemaVersion: 2,
      cooldownSeconds: input.cooldownSeconds,
      createdByUserId: actor.user.id,
      updatedByUserId: actor.user.id,
    }).returning();

    await tx.insert(alertPolicyChannels).values(channelIds.map((channelId) => ({
      policyId: row.id,
      channelId,
    })));
    if (targetIds.length > 0) {
      await tx.insert(alertPolicyTargets).values(targetIds.map((canonicalTargetId) => ({
        policyId: row.id,
        canonicalTargetId,
      })));
    }
    return row;
  });

  return mapAlertPolicy(policy, channelIds.toSorted(), targetIds.toSorted());
}

async function getActiveAlertPolicy(policyId: string) {
  const [row] = await db.select().from(alertPolicies).where(and(
    eq(alertPolicies.id, policyId),
    isNull(alertPolicies.deletedAt),
  )).limit(1);
  if (!row) {
    throw new Error("The requested alert policy could not be found.");
  }
  return row;
}

export async function updateAlertPolicy(
  actor: ActorContext,
  policyId: string,
  input: UpdateAlertPolicyRequest,
) {
  assertCanManageAlerts(actor);
  await getActiveAlertPolicy(policyId);

  if (!("name" in input)) {
    const [row, channels, targets] = await Promise.all([
      db.update(alertPolicies).set({
        state: input.state,
        updatedAt: new Date(),
        updatedByUserId: actor.user.id,
      }).where(and(eq(alertPolicies.id, policyId), isNull(alertPolicies.deletedAt))).returning().then((items) => items[0]),
      db.select({ channelId: alertPolicyChannels.channelId }).from(alertPolicyChannels)
        .where(eq(alertPolicyChannels.policyId, policyId)),
      db.select({ targetId: alertPolicyTargets.canonicalTargetId }).from(alertPolicyTargets)
        .where(eq(alertPolicyTargets.policyId, policyId)),
    ]);

    return mapAlertPolicy(
      row,
      channels.map((channel) => channel.channelId).toSorted(),
      targets.map((target) => target.targetId).toSorted(),
    );
  }

  const { channelIds, targetIds } = await validateAlertPolicyLinks(input);
  const conditions = alertPolicyConditionsSchema.parse(input.conditions);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(alertPolicies).set({
      name: input.name,
      state: input.state,
      coverage: input.coverage,
      conditionsJson: conditions,
      conditionsSchemaVersion: 2,
      cooldownSeconds: input.cooldownSeconds,
      updatedAt: new Date(),
      updatedByUserId: actor.user.id,
    }).where(and(eq(alertPolicies.id, policyId), isNull(alertPolicies.deletedAt))).returning();
    await tx.delete(alertPolicyChannels).where(eq(alertPolicyChannels.policyId, policyId));
    await tx.delete(alertPolicyTargets).where(eq(alertPolicyTargets.policyId, policyId));
    await tx.insert(alertPolicyChannels).values(channelIds.map((channelId) => ({
      policyId,
      channelId,
    })));
    if (targetIds.length > 0) {
      await tx.insert(alertPolicyTargets).values(targetIds.map((canonicalTargetId) => ({
        policyId,
        canonicalTargetId,
      })));
    }
    return updated;
  });

  return mapAlertPolicy(
    row,
    channelIds.toSorted(),
    targetIds.toSorted(),
  );
}

export async function deleteAlertPolicy(actor: ActorContext, policyId: string) {
  assertCanManageAlerts(actor);
  await getActiveAlertPolicy(policyId);

  await db.transaction(async (tx) => {
    await tx.delete(alertPolicyChannels).where(eq(alertPolicyChannels.policyId, policyId));
    await tx.delete(alertPolicyTargets).where(eq(alertPolicyTargets.policyId, policyId));
    await tx.update(alertPolicies).set({
      state: "paused",
      deletedAt: new Date(),
      updatedAt: new Date(),
      updatedByUserId: actor.user.id,
    }).where(eq(alertPolicies.id, policyId));
  });

  return deleteAlertPolicyResponseSchema.parse({ deletedPolicyId: policyId });
}

export async function getAlertSettingsSnapshot(actor: ActorContext) {
  assertCanManageAlerts(actor);
  const [channels, policies, readiness, emailProvider] = await Promise.all([
    listAlertChannels(actor),
    listAlertPolicies(actor),
    getAlertSetupReadiness(),
    getEmailProviderSettings(actor),
  ]);

  return {
    readiness,
    emailProvider,
    channels: channels.items,
    policies: policies.items,
  };
}
