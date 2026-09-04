import { z } from "zod";

import { isoDateSchema } from "./common.ts";
import {
  normalizeSendingDomain,
  SENDING_DOMAIN_ERROR,
  SENDING_DOMAIN_PATTERN,
} from "../validation/sending-domain.ts";

export const alertChannelTypeSchema = z.enum(["email", "slack", "webhook"]);
export const alertPolicyStateSchema = z.enum(["draft", "enabled", "paused"]);
export const alertPolicySelectionModeSchema = z.enum(["all", "selected"]);
export const alertPolicyCoverageSchema = z.enum(["all_targets", "selected_targets"]);

const displayNameSchema = z.string().trim().min(1).max(100);
const emailRecipientSchema = z.string().trim().email().max(320);

export const alertSetupCapabilitySchema = z.object({
  status: z.enum(["ready", "needs_configuration", "invalid_configuration", "unverified"]),
  detail: z.string(),
  missingEnvironmentVariables: z.array(z.string()).default([]),
});

export const alertSetupReadinessSchema = z.object({
  inAppChanges: alertSetupCapabilitySchema,
  email: alertSetupCapabilitySchema,
  webhooks: alertSetupCapabilitySchema,
  deliveryWorker: alertSetupCapabilitySchema,
});

export const emailProviderSettingsSchema = z.object({
  provider: z.literal("resend"),
  domainName: z.string().min(1),
  senderName: z.string().min(1),
  senderLocalPart: z.string().min(1),
  fromAddress: z.email(),
  testRecipient: z.email(),
  encrypted: z.boolean(),
  oauthScope: z.string().min(1),
  lastTestStatus: z.enum(["untested", "succeeded", "failed"]),
  lastTestedAt: isoDateSchema.nullable(),
  lastTestErrorCategory: z.string().nullable(),
  updatedAt: isoDateSchema,
});

export const resendSetupSessionSchema = z.object({
  id: z.string().uuid(),
  oauthScope: z.string().min(1),
  expiresAt: isoDateSchema,
});

const sendingDomainSchema = z.string().trim().min(1).max(253).regex(
  SENDING_DOMAIN_PATTERN,
  SENDING_DOMAIN_ERROR,
).transform(normalizeSendingDomain);

const senderLocalPartSchema = z.string().trim().min(1).max(64).regex(
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/,
  "Enter a valid email address prefix.",
);

const senderNameSchema = z.string().trim().min(1).max(100).refine(
  (value) => !/[\r\n]/.test(value),
  "Sender name must be a single line.",
);

export const configureEmailProviderRequestSchema = z.object({
  setupSessionId: z.string().uuid(),
  domainName: sendingDomainSchema,
  senderName: senderNameSchema,
  senderLocalPart: senderLocalPartSchema,
  testRecipient: emailRecipientSchema,
});

export const updateEmailProviderRequestSchema = z.object({
  domainName: sendingDomainSchema,
  senderName: senderNameSchema,
  senderLocalPart: senderLocalPartSchema,
  testRecipient: emailRecipientSchema,
}).strict();

export const testEmailProviderRequestSchema = z.object({
  recipient: emailRecipientSchema.optional(),
});

export const emailAlertChannelConfigSchema = z.object({
  recipients: z.array(emailRecipientSchema).min(1).max(25),
});

export const webhookAlertChannelConfigSchema = z.object({
  hostname: z.string().min(1),
  hasAuthorizationHeader: z.boolean(),
  hasSigningSecret: z.boolean(),
});

const slackDestinationLabelSchema = z.string().trim().min(1).max(100).transform((value) => (
  value.startsWith("#") ? value.slice(1) : value
));

export const slackAlertChannelConfigSchema = z.object({
  workspaceId: z.string().min(1).nullable(),
  workspaceName: z.string().min(1).nullable(),
  channelId: z.string().min(1).nullable(),
  channelName: z.string().min(1),
  connectionSource: z.enum(["oauth", "manual"]),
  configurationUrl: z.url().nullable(),
});

export const alertChannelSchema = z.discriminatedUnion("channelType", [
  z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    channelType: z.literal("email"),
    enabled: z.boolean(),
    config: emailAlertChannelConfigSchema,
    lastTestStatus: z.enum(["untested", "succeeded", "failed"]),
    lastTestedAt: isoDateSchema.nullable(),
    lastTestErrorCategory: z.string().nullable(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  }),
  z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    channelType: z.literal("slack"),
    enabled: z.boolean(),
    config: slackAlertChannelConfigSchema,
    lastTestStatus: z.enum(["untested", "succeeded", "failed"]),
    lastTestedAt: isoDateSchema.nullable(),
    lastTestErrorCategory: z.string().nullable(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  }),
  z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    channelType: z.literal("webhook"),
    enabled: z.boolean(),
    config: webhookAlertChannelConfigSchema,
    lastTestStatus: z.enum(["untested", "succeeded", "failed"]),
    lastTestedAt: isoDateSchema.nullable(),
    lastTestErrorCategory: z.string().nullable(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  }),
]);

export const listAlertChannelsResponseSchema = z.object({ items: z.array(alertChannelSchema) });

export const createEmailAlertChannelRequestSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("email"),
  recipients: z.array(emailRecipientSchema).min(1).max(25),
  enabled: z.boolean().default(true),
});

export const createWebhookAlertChannelRequestSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("webhook"),
  endpoint: z.url().max(2_048),
  authorizationHeader: z.string().trim().min(1).max(2_048).optional(),
  signingSecret: z.string().min(16).max(512).optional(),
  enabled: z.boolean().default(true),
});

export const createSlackAlertChannelRequestSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("slack"),
  webhookUrl: z.url().max(2_048),
  channelName: slackDestinationLabelSchema,
  workspaceName: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().default(true),
});

export const createAlertChannelRequestSchema = z.discriminatedUnion("channelType", [
  createEmailAlertChannelRequestSchema,
  createSlackAlertChannelRequestSchema,
  createWebhookAlertChannelRequestSchema,
]);

const updateEmailAlertChannelConfigurationSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("email"),
  recipients: z.array(emailRecipientSchema).min(1).max(25),
  enabled: z.boolean(),
}).strict();

const updateWebhookAlertChannelConfigurationSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("webhook"),
  endpoint: z.url().max(2_048).optional(),
  authorizationHeader: z.string().trim().min(1).max(2_048).optional(),
  signingSecret: z.string().min(16).max(512).optional(),
  clearAuthorizationHeader: z.boolean().default(false),
  clearSigningSecret: z.boolean().default(false),
  enabled: z.boolean(),
}).strict();

const updateSlackAlertChannelConfigurationSchema = z.object({
  displayName: displayNameSchema,
  channelType: z.literal("slack"),
  webhookUrl: z.url().max(2_048).optional(),
  channelName: slackDestinationLabelSchema,
  workspaceName: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean(),
}).strict();

export const updateAlertChannelRequestSchema = z.union([
  z.object({ enabled: z.boolean() }).strict(),
  z.discriminatedUnion("channelType", [
    updateEmailAlertChannelConfigurationSchema,
    updateSlackAlertChannelConfigurationSchema,
    updateWebhookAlertChannelConfigurationSchema,
  ]),
]);

export const testAlertChannelResponseSchema = z.object({
  channel: alertChannelSchema,
  delivered: z.boolean(),
  message: z.string(),
});

export const deleteAlertChannelResponseSchema = z.object({ deletedChannelId: z.string().uuid() });

export const alertPolicyConditionsSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || "selectionMode" in value) {
    return value;
  }

  const legacy = value as { changeTypes?: unknown };
  return {
    ...legacy,
    selectionMode: Array.isArray(legacy.changeTypes) && legacy.changeTypes.length > 0 ? "selected" : "all",
  };
}, z.object({
  selectionMode: alertPolicySelectionModeSchema.default("all"),
  changeTypes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
}).superRefine((conditions, context) => {
  if (conditions.selectionMode === "selected" && conditions.changeTypes.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["changeTypes"],
      message: "Select at least one change type.",
    });
  }
}));

export const alertPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  state: alertPolicyStateSchema,
  coverage: alertPolicyCoverageSchema,
  conditions: alertPolicyConditionsSchema,
  cooldownSeconds: z.number().int().nonnegative(),
  channelIds: z.array(z.string().uuid()),
  targetIds: z.array(z.string().uuid()),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

export const listAlertPoliciesResponseSchema = z.object({ items: z.array(alertPolicySchema) });

export const createAlertPolicyRequestSchema = z.object({
  name: displayNameSchema,
  state: alertPolicyStateSchema.default("enabled"),
  coverage: alertPolicyCoverageSchema.default("all_targets"),
  conditions: alertPolicyConditionsSchema,
  cooldownSeconds: z.number().int().min(0).max(2_592_000).default(0),
  channelIds: z.array(z.string().uuid()).min(1).max(25),
  targetIds: z.array(z.string().uuid()).max(100).default([]),
}).superRefine((policy, context) => {
  if (policy.coverage === "selected_targets" && policy.targetIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["targetIds"],
      message: "Select at least one target.",
    });
  }

  if (policy.coverage === "all_targets" && policy.targetIds.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["targetIds"],
      message: "Target selections require selected-target coverage.",
    });
  }
});

export const updateAlertPolicyRequestSchema = z.union([
  z.object({ state: z.enum(["enabled", "paused"]) }).strict(),
  createAlertPolicyRequestSchema,
]);

export const deleteAlertPolicyResponseSchema = z.object({ deletedPolicyId: z.string().uuid() });

export type AlertSetupReadiness = z.infer<typeof alertSetupReadinessSchema>;
export type EmailProviderSettings = z.infer<typeof emailProviderSettingsSchema>;
export type ResendSetupSession = z.infer<typeof resendSetupSessionSchema>;
export type AlertChannel = z.infer<typeof alertChannelSchema>;
export type CreateAlertChannelRequest = z.infer<typeof createAlertChannelRequestSchema>;
export type UpdateAlertChannelRequest = z.infer<typeof updateAlertChannelRequestSchema>;
export type AlertPolicy = z.infer<typeof alertPolicySchema>;
export type CreateAlertPolicyRequest = z.infer<typeof createAlertPolicyRequestSchema>;
export type UpdateAlertPolicyRequest = z.infer<typeof updateAlertPolicyRequestSchema>;
