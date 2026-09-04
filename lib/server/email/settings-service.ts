import { and, eq, gt, isNull } from "drizzle-orm";
import { Resend } from "resend";

import { canManageAlerts } from "@/lib/authorization/authz";
import {
  emailProviderSettingsSchema,
  resendSetupSessionSchema,
  type EmailProviderSettings,
} from "@/lib/contracts/alerts";
import { db } from "@/lib/db/client";
import {
  alertChannels,
  emailProviderSettings,
  resendOauthSetupSessions,
} from "@/lib/db/schema";
import type { ActorContext } from "@/lib/session/actor-context";
import {
  getOptionalConfiguredAlertEncryptionKey,
  protectAlertSecret,
  readStoredAlertSecret,
} from "@/lib/server/alerts/secret-encryption";
import {
  EMAIL_PROVIDER_SETTINGS_ID,
  deliverConfiguredEmail,
  formatConfiguredFromAddress,
  getStoredEmailProviderSettings,
} from "@/lib/server/email/provider";
import { buildTestEmail } from "@/lib/server/email/templates/test-email";
import {
  assertUsableResendOauthScope,
  getConfiguredResendOauthGrant,
  parseResendOauthTokenBundle,
  serializeResendOauthTokenBundle,
} from "@/lib/server/email/oauth-grant";
import {
  refreshResendOauthToken,
  revokeResendOauthGrant,
} from "@/lib/server/email/resend-oauth";

const RESEND_SETUP_LIFETIME_MS = 30 * 60 * 1_000;

function assertCanManageEmail(actor: ActorContext) {
  if (!canManageAlerts(actor)) throw new Error("You do not have permission to manage email delivery.");
}

function mapEmailProviderSettings(
  row: typeof emailProviderSettings.$inferSelect,
): EmailProviderSettings {
  return emailProviderSettingsSchema.parse({
    provider: "resend",
    domainName: row.domainName,
    senderName: row.senderName,
    senderLocalPart: row.senderLocalPart,
    fromAddress: `${row.senderLocalPart}@${row.domainName}`,
    testRecipient: row.testRecipient,
    encrypted: row.secretPlaintext === null,
    oauthScope: row.oauthScope,
    lastTestStatus: row.lastTestStatus,
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
    lastTestErrorCategory: row.lastTestErrorCategory,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function getEmailProviderSettings(actor: ActorContext) {
  assertCanManageEmail(actor);
  const settings = await getStoredEmailProviderSettings();
  return settings ? mapEmailProviderSettings(settings) : null;
}

export async function createResendSetupSession(
  actor: ActorContext,
  input: {
    clientId: string;
    oauthScope: string;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  },
) {
  assertCanManageEmail(actor);
  assertUsableResendOauthScope(input.oauthScope);
  const now = new Date();
  const [session] = await db.insert(resendOauthSetupSessions).values({
    userId: actor.user.id,
    clientId: input.clientId,
    oauthScope: input.oauthScope,
    ...protectAlertSecret(serializeResendOauthTokenBundle({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
    }), getOptionalConfiguredAlertEncryptionKey()),
    accessTokenExpiresAt: new Date(now.getTime() + input.expiresIn * 1_000),
    expiresAt: new Date(now.getTime() + RESEND_SETUP_LIFETIME_MS),
  }).returning();

  return session;
}

async function getActiveSetupSession(actor: ActorContext, setupSessionId: string) {
  assertCanManageEmail(actor);
  const [session] = await db.select().from(resendOauthSetupSessions).where(and(
    eq(resendOauthSetupSessions.id, setupSessionId),
    eq(resendOauthSetupSessions.userId, actor.user.id),
    gt(resendOauthSetupSessions.expiresAt, new Date()),
  )).limit(1);
  if (!session) throw new Error("The Resend setup session expired. Connect Resend again.");

  const key = getOptionalConfiguredAlertEncryptionKey();
  const serialized = readStoredAlertSecret(session, key);
  let bundle = parseResendOauthTokenBundle(serialized);
  let accessTokenExpiresAt = session.accessTokenExpiresAt;
  let oauthScope = session.oauthScope;

  if (accessTokenExpiresAt.getTime() <= Date.now() + 30_000) {
    const refreshed = await refreshResendOauthToken(session.clientId, bundle.refreshToken);
    assertUsableResendOauthScope(refreshed.scope);
    bundle = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token };
    accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1_000);
    oauthScope = refreshed.scope;
    await db.update(resendOauthSetupSessions).set({
      ...protectAlertSecret(serializeResendOauthTokenBundle(bundle), key),
      oauthScope,
      accessTokenExpiresAt,
    }).where(eq(resendOauthSetupSessions.id, session.id));
  } else if (session.secretPlaintext !== null && key !== null) {
    await db.update(resendOauthSetupSessions).set({
      ...protectAlertSecret(serialized, key),
    }).where(eq(resendOauthSetupSessions.id, session.id));
  }

  return { session: { ...session, accessTokenExpiresAt, oauthScope }, bundle };
}

export async function getResendSetupSession(actor: ActorContext, setupSessionId: string) {
  const { session } = await getActiveSetupSession(actor, setupSessionId);
  return resendSetupSessionSchema.parse({
    id: session.id,
    oauthScope: session.oauthScope,
    expiresAt: session.expiresAt.toISOString(),
  });
}

export async function configureEmailProvider(
  actor: ActorContext,
  input: {
    setupSessionId: string;
    domainName: string;
    senderName: string;
    senderLocalPart: string;
    testRecipient: string;
  },
) {
  const { session, bundle } = await getActiveSetupSession(actor, input.setupSessionId);
  const client = new Resend(bundle.accessToken);
  const setupEmail = buildTestEmail("provider");
  const test = await client.emails.send({
    from: formatConfiguredFromAddress(input.senderName, input.senderLocalPart, input.domainName),
    to: input.testRecipient,
    ...setupEmail,
  });
  if (test.error) {
    const mismatch = test.error.statusCode === 403;
    throw new Error(mismatch
      ? "Resend rejected this sender domain. Enter the exact verified domain authorized during connection, or reconnect Resend and grant access to it."
      : "Resend rejected the test email. Check the sender address and recipient, then try again.");
  }

  const current = await getStoredEmailProviderSettings();
  const key = getOptionalConfiguredAlertEncryptionKey();
  const currentGrant = current
    ? {
        clientId: current.oauthClientId,
        refreshToken: parseResendOauthTokenBundle(readStoredAlertSecret(current, key)).refreshToken,
      }
    : null;
  const now = new Date();
  const [stored] = await db.insert(emailProviderSettings).values({
    id: EMAIL_PROVIDER_SETTINGS_ID,
    provider: "resend",
    domainName: input.domainName,
    senderName: input.senderName,
    senderLocalPart: input.senderLocalPart,
    testRecipient: input.testRecipient.toLowerCase(),
    oauthClientId: session.clientId,
    oauthScope: session.oauthScope,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    ...protectAlertSecret(serializeResendOauthTokenBundle(bundle), key),
    lastTestStatus: "succeeded",
    lastTestedAt: now,
    lastTestErrorCategory: null,
    createdByUserId: actor.user.id,
    updatedByUserId: actor.user.id,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: emailProviderSettings.id,
    set: {
      domainName: input.domainName,
      senderName: input.senderName,
      senderLocalPart: input.senderLocalPart,
      testRecipient: input.testRecipient.toLowerCase(),
      oauthClientId: session.clientId,
      oauthScope: session.oauthScope,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      ...protectAlertSecret(serializeResendOauthTokenBundle(bundle), key),
      lastTestStatus: "succeeded",
      lastTestedAt: now,
      lastTestErrorCategory: null,
      updatedByUserId: actor.user.id,
      updatedAt: now,
    },
  }).returning();

  await db.delete(resendOauthSetupSessions).where(eq(resendOauthSetupSessions.id, session.id));
  if (currentGrant && currentGrant.clientId !== session.clientId) {
    await revokeResendOauthGrant(currentGrant.clientId, currentGrant.refreshToken).catch(() => undefined);
  }
  return mapEmailProviderSettings(stored);
}

export async function updateEmailProvider(
  actor: ActorContext,
  input: { domainName: string; senderName: string; senderLocalPart: string; testRecipient: string },
) {
  assertCanManageEmail(actor);
  const grant = await getConfiguredResendOauthGrant();
  if (!grant) throw new Error("Connect Resend before editing email settings.");
  const setupEmail = buildTestEmail("provider");
  const test = await new Resend(grant.accessToken).emails.send({
    from: formatConfiguredFromAddress(input.senderName, input.senderLocalPart, input.domainName),
    to: input.testRecipient,
    ...setupEmail,
  });
  if (test.error) {
    throw new Error(test.error.statusCode === 403
      ? "Resend rejected this sender domain. Reconnect Resend and authorize that domain, or restore the previous domain."
      : "Resend rejected the test email. Check the sender address and recipient, then try again.");
  }
  const now = new Date();
  const [updated] = await db.update(emailProviderSettings).set({
    domainName: input.domainName,
    senderName: input.senderName,
    senderLocalPart: input.senderLocalPart,
    testRecipient: input.testRecipient.toLowerCase(),
    lastTestStatus: "succeeded",
    lastTestedAt: now,
    lastTestErrorCategory: null,
    updatedByUserId: actor.user.id,
    updatedAt: now,
  }).where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID)).returning();
  if (!updated) throw new Error("Connect Resend before editing email settings.");
  return mapEmailProviderSettings(updated);
}

export async function testEmailProvider(actor: ActorContext, recipient?: string) {
  assertCanManageEmail(actor);
  const current = await getStoredEmailProviderSettings();
  if (!current) throw new Error("Connect Resend before testing email delivery.");
  const now = new Date();
  const setupEmail = buildTestEmail("provider");
  const result = await deliverConfiguredEmail({
    to: recipient ?? current.testRecipient,
    ...setupEmail,
  });
  const [updated] = await db.update(emailProviderSettings).set({
    testRecipient: (recipient ?? current.testRecipient).toLowerCase(),
    lastTestStatus: result.ok ? "succeeded" : "failed",
    lastTestedAt: now,
    lastTestErrorCategory: result.ok ? null : result.category,
    updatedByUserId: actor.user.id,
    updatedAt: now,
  }).where(eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID)).returning();
  return { settings: mapEmailProviderSettings(updated), delivered: result.ok, message: result.ok ? "Test email sent." : result.safeMessage };
}

export async function disconnectEmailProvider(actor: ActorContext) {
  assertCanManageEmail(actor);
  const current = await getStoredEmailProviderSettings();
  if (!current) return;
  const bundle = parseResendOauthTokenBundle(readStoredAlertSecret(
    current,
    getOptionalConfiguredAlertEncryptionKey(),
  ));
  await revokeResendOauthGrant(current.oauthClientId, bundle.refreshToken);
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.update(alertChannels).set({
      enabled: false,
      updatedAt: now,
      updatedByUserId: actor.user.id,
    }).where(and(
      eq(alertChannels.channelType, "email"),
      eq(alertChannels.enabled, true),
      isNull(alertChannels.deletedAt),
    ));
    await transaction.delete(emailProviderSettings).where(
      eq(emailProviderSettings.id, EMAIL_PROVIDER_SETTINGS_ID),
    );
  });
}
